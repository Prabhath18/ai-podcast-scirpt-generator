import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './testDb.js';
import { sampleOutline } from './fixtures.js';

async function signup(app, email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ email, password: 'password123' });
  return agent;
}

describe('comment permissions', () => {
  let app;
  let owner;
  let commenter;
  let outsider;
  let projectId;
  let token;

  const ownerUrl = () => `/api/projects/${projectId}/comments`;
  const sharedUrl = () => `/api/shared/${token}/comments`;

  beforeEach(async () => {
    ({ app } = createTestApp());
    owner = await signup(app, 'owner@example.com');
    commenter = await signup(app, 'maya.lee@example.com');
    outsider = await signup(app, 'outsider@example.com');

    const created = await owner.post('/api/projects').send({ title: 'Episode', outline: sampleOutline() });
    projectId = created.body.project.id;
    token = (await owner.post(`/api/projects/${projectId}/share`)).body.shareToken;
  });

  describe('owner', () => {
    it('can comment on the episode and on a segment, and read both back', async () => {
      const episode = await owner.post(ownerUrl()).send({ body: 'Overall note' });
      const segment = await owner.post(ownerUrl()).send({ body: 'Tighten this', segmentId: 2 });
      expect(episode.status).toBe(201);
      expect(episode.body.comment.segmentId).toBeNull();
      expect(segment.body.comment.segmentId).toBe(2);

      const list = await owner.get(ownerUrl());
      expect(list.body.comments.map((c) => c.body)).toEqual(['Overall note', 'Tighten this']);
      expect(list.body.comments.every((c) => c.isMine)).toBe(true);
    });

    it('can resolve and reopen any comment', async () => {
      const posted = await commenter.post(sharedUrl()).send({ body: 'Typo in segment 1', segmentId: 1 });
      const id = posted.body.comment.id;

      const resolved = await owner.patch(`${ownerUrl()}/${id}`).send({ resolved: true });
      expect(resolved.status).toBe(200);
      expect(resolved.body.comment.resolved).toBe(true);

      const reopened = await owner.patch(`${ownerUrl()}/${id}`).send({ resolved: false });
      expect(reopened.body.comment.resolved).toBe(false);
    });

    it("can delete someone else's comment", async () => {
      const posted = await commenter.post(sharedUrl()).send({ body: 'Off topic' });
      const res = await owner.delete(`${ownerUrl()}/${posted.body.comment.id}`);
      expect(res.status).toBe(204);
      expect((await owner.get(ownerUrl())).body.comments).toHaveLength(0);
    });

    it('keeps working on the owner route when comments are switched off for the share link', async () => {
      await owner.patch(`/api/projects/${projectId}/share`).send({ commentsEnabled: false });
      const res = await owner.post(ownerUrl()).send({ body: 'Still mine to write' });
      expect(res.status).toBe(201);
    });
  });

  describe('commenter (signed in, using the share link)', () => {
    it('can read the thread and post episode-level and segment comments', async () => {
      await owner.post(ownerUrl()).send({ body: 'Owner note' });
      const posted = await commenter.post(sharedUrl()).send({ body: 'Nice intro', segmentId: 1 });
      expect(posted.status).toBe(201);
      expect(posted.body.comment.author.name).toBe('maya.lee');
      expect(posted.body.comment.isMine).toBe(true);

      const list = await commenter.get(sharedUrl());
      expect(list.status).toBe(200);
      expect(list.body.comments).toHaveLength(2);
      expect(list.body.comments.find((c) => c.body === 'Owner note').isMine).toBe(false);
    });

    it('never receives anyone\'s email address', async () => {
      await owner.post(ownerUrl()).send({ body: 'Owner note' });
      const list = await commenter.get(sharedUrl());
      expect(JSON.stringify(list.body)).not.toMatch(/@example\.com/);
    });

    it('can delete their own comment but not the owner\'s', async () => {
      const ownerComment = await owner.post(ownerUrl()).send({ body: 'Owner note' });
      const mine = await commenter.post(sharedUrl()).send({ body: 'Mine' });

      const denied = await commenter.delete(`${sharedUrl()}/${ownerComment.body.comment.id}`);
      expect(denied.status).toBe(403);

      const allowed = await commenter.delete(`${sharedUrl()}/${mine.body.comment.id}`);
      expect(allowed.status).toBe(204);
    });

    it('cannot resolve a comment, even their own', async () => {
      const mine = await commenter.post(sharedUrl()).send({ body: 'Mine' });
      const res = await commenter.patch(`${sharedUrl()}/${mine.body.comment.id}`).send({ resolved: true });
      expect(res.status).toBe(403);
    });

    it('cannot use the owner route', async () => {
      const res = await commenter.get(ownerUrl());
      expect(res.status).toBe(404);
    });
  });

  describe('outsider', () => {
    it('is signed out: 401 on every shared comments route', async () => {
      expect((await request(app).get(sharedUrl())).status).toBe(401);
      expect((await request(app).post(sharedUrl()).send({ body: 'hi' })).status).toBe(401);
    });

    it('is signed in but holds no valid link: 404', async () => {
      expect((await outsider.get('/api/shared/not-a-real-token/comments')).status).toBe(404);
      expect((await outsider.get(ownerUrl())).status).toBe(404);
      expect((await outsider.post(ownerUrl()).send({ body: 'hi' })).status).toBe(404);
    });

    it('loses access when the owner revokes the link', async () => {
      await owner.delete(`/api/projects/${projectId}/share`);
      expect((await commenter.get(sharedUrl())).status).toBe(404);
    });

    it("cannot touch a comment that belongs to another project", async () => {
      const otherProject = await owner.post('/api/projects').send({ title: 'Other', outline: sampleOutline() });
      const otherToken = (await owner.post(`/api/projects/${otherProject.body.project.id}/share`)).body.shareToken;
      const posted = await commenter.post(`/api/shared/${otherToken}/comments`).send({ body: 'On the other episode' });

      const res = await commenter.delete(`${sharedUrl()}/${posted.body.comment.id}`);
      expect(res.status).toBe(404);
    });
  });

  describe('comments switched off', () => {
    beforeEach(async () => {
      await owner.patch(`/api/projects/${projectId}/share`).send({ commentsEnabled: false });
    });

    it('blocks reading and posting on the shared route with COMMENTS_DISABLED', async () => {
      const read = await commenter.get(sharedUrl());
      const write = await commenter.post(sharedUrl()).send({ body: 'hello' });
      expect(read.status).toBe(403);
      expect(read.body.code).toBe('COMMENTS_DISABLED');
      expect(write.status).toBe(403);
    });

    it('is reported on the public share payload so the UI can hide the panel', async () => {
      const res = await request(app).get(`/api/shared/${token}`);
      expect(res.body.commentsEnabled).toBe(false);
    });

    it('can be turned back on', async () => {
      await owner.patch(`/api/projects/${projectId}/share`).send({ commentsEnabled: true });
      expect((await commenter.post(sharedUrl()).send({ body: 'hello again' })).status).toBe(201);
    });

    it('only the owner can flip the switch', async () => {
      const res = await commenter.patch(`/api/projects/${projectId}/share`).send({ commentsEnabled: true });
      expect(res.status).toBe(404);
    });
  });

  describe('input validation', () => {
    it('rejects an empty or over-long body', async () => {
      expect((await owner.post(ownerUrl()).send({ body: '   ' })).status).toBe(400);
      expect((await owner.post(ownerUrl()).send({ body: 'x'.repeat(1001) })).status).toBe(400);
      expect((await owner.post(ownerUrl()).send({ body: 'x'.repeat(1000) })).status).toBe(201);
    });

    it('rejects a segmentId that is not in the outline', async () => {
      const res = await owner.post(ownerUrl()).send({ body: 'hi', segmentId: 99 });
      expect(res.status).toBe(400);
      expect(res.body.details[0].field).toBe('segmentId');
    });

    it('treats SQL metacharacters in a comment as plain text', async () => {
      const nasty = "'); DROP TABLE comments; --";
      await owner.post(ownerUrl()).send({ body: nasty });
      const list = await owner.get(ownerUrl());
      expect(list.body.comments[0].body).toBe(nasty);
    });

    it('returns 404 for a non-numeric comment id', async () => {
      expect((await owner.delete(`${ownerUrl()}/abc`)).status).toBe(404);
    });
  });

  it('deletes a project\'s comments along with the project', async () => {
    const { app: freshApp, db } = createTestApp();
    const user = await signup(freshApp, 'solo@example.com');
    const project = await user.post('/api/projects').send({ title: 'T', outline: sampleOutline() });
    await user.post(`/api/projects/${project.body.project.id}/comments`).send({ body: 'note' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n).toBe(1);

    await user.delete(`/api/projects/${project.body.project.id}`);
    expect(db.prepare('SELECT COUNT(*) AS n FROM comments').get().n).toBe(0);
  });
});
