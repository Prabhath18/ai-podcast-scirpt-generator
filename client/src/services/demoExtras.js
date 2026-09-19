// Offline sample data for the bundled demos, so every feature can be shown with
// no API key and no network: alternative outlines, research suggestions (real
// Wikipedia articles, described in plain words -- no statistics), an intro and
// outro set, and comments. Merged into each demo by demoData.js.

const wiki = (title, summary, slug = title.replace(/ /g, '_')) => ({
  type: 'wikipedia',
  title,
  summary,
  url: `https://en.wikipedia.org/wiki/${slug}`,
});

const segment = (id, title, talking_points, duration_mins, transition) => ({ id, title, talking_points, duration_mins, transition });

export const demoExtras = {
  tech: {
    research: {
      topic: [
        wiki('GitHub Copilot', 'A code-completion and programming assistant from GitHub that suggests code inside editors such as Visual Studio Code.'),
        wiki('Large language model', 'A language model trained on very large amounts of text, used for tasks such as generating and summarizing text.'),
        wiki('Software engineering', 'The systematic design, development, testing and maintenance of software.'),
      ],
      1: [
        wiki('Autocomplete', 'A feature that predicts the rest of a word or phrase as the user types.'),
        wiki('GitHub Copilot', 'A code-completion and programming assistant from GitHub that suggests code inside editors such as Visual Studio Code.'),
        wiki('Intelligent agent', 'Something that perceives its environment and takes actions to reach a goal.'),
      ],
      2: [
        wiki('Boilerplate code', 'Sections of code that are repeated in many places with little or no change.', 'Boilerplate_code'),
        wiki('Unit testing', 'A way of testing the smallest parts of a program in isolation.'),
      ],
      3: [
        wiki('Code review', 'Systematic examination of source code to find mistakes and improve quality.'),
        wiki('Software bug', 'A flaw in a program that makes it behave in ways nobody intended.'),
        wiki('Deskilling', 'A reduction in the skill a job requires, often through automation or splitting work into simpler tasks.'),
      ],
      4: [
        wiki('Prompt engineering', 'Writing instructions for a generative AI model so it produces the output you want.'),
        wiki('Code review', 'Systematic examination of source code to find mistakes and improve quality.'),
      ],
      5: [
        wiki('Automation', 'Using technology to perform a task with little human involvement.'),
        wiki('Software engineering', 'The systematic design, development, testing and maintenance of software.'),
      ],
      6: [wiki('Lifelong learning', 'The ongoing, voluntary pursuit of knowledge and skills throughout life.')],
    },
    pins: { 1: [0], 3: [0, 2] },
    variations: [
      {
        approach: 'Myth-busting',
        rationale: 'Listeners arrive with strong opinions, so testing each common belief keeps the episode argumentative and clear.',
        title: 'Five Myths About AI Coding Assistants, Tested',
        intro: 'You have heard that AI will replace programmers, and you have heard it is just fancy autocomplete. Both cannot be true. Today we test the most common claims one by one.',
        segments: [
          segment(1, 'Myth: The AI Writes Better Code Than You', ['Where suggestions are strong: repetitive, well-documented patterns', 'Where they fail: edge cases, concurrency and unfamiliar internal APIs', 'A quick exercise: ask for the same function twice and compare'], 9, 'So it is not better across the board. Is it at least replacing juniors?'),
          segment(2, "Myth: Junior Developers Are Finished", ['What juniors actually do all day besides typing code', 'Why reviewing and debugging still need a person who understands the system', 'How teams are changing onboarding rather than dropping it'], 9, 'If people still matter, is this just autocomplete with better marketing?'),
          segment(3, "Myth: It's Just Autocomplete", ['The shift from single-line suggestions to multi-file, tool-using agents', 'What "agentic" adds: reading files, running commands, retrying', 'Why the label still matters for how much trust to extend'], 9, 'Neither extreme holds up. So what does the evidence say?'),
          segment(4, 'What the Evidence Actually Shows', ['Separating vendor claims from independent studies', 'Why speed on small tasks may not equal speed across a project', 'The questions to ask before trusting any productivity number'], 9, 'With that in mind, here is a sane way to work.'),
          segment(5, 'A Sane Way to Work With It', ['Draft with the tool, understand before you ship', 'Keep humans in the review loop', 'Write down the mistakes it keeps making for you'], 9, ''),
        ],
        outro: 'Skepticism is a skill worth keeping. Try one of these tests on your own codebase this week, and tell us what you find.',
      },
      {
        approach: 'A week in the life',
        rationale: 'Anchoring on concrete workdays makes the abstract trade-offs feel real and keeps a non-technical audience with us.',
        title: 'One Week With an AI Pair Programmer',
        intro: 'Imagine a normal work week, except a tireless assistant sits next to you. Some days it saves the afternoon. Some days it nearly ships a bug. Let us walk through five of them.',
        segments: [
          segment(1, 'Monday: The Suggestion That Almost Shipped', ['A plausible-looking function with a subtle off-by-one', 'How a failing test caught it', 'The habit that would have caught it sooner'], 9, 'Tuesday went better.'),
          segment(2, 'Wednesday: When It Nailed It', ['Generating an API client and its tests in minutes', 'Asking it to explain an unfamiliar module first', 'What made the request specific enough to work'], 9, 'But not every day is a win.'),
          segment(3, 'Thursday: The Review Nobody Wanted', ['A large AI-assisted pull request and reviewer fatigue', 'What a good review looks like when most code is generated', 'Splitting changes so a person can actually read them'], 9, 'All of this changes how teams work.'),
          segment(4, 'Friday: What Changed in Hiring', ['Interview questions that test judgment, not recall', 'How mentors adapt when juniors have an assistant', 'What managers say they look for now'], 9, 'Which leads to the rules we would pin to the wall.'),
          segment(5, 'The Rules on the Wall', ['Never merge what you cannot explain', 'Keep a list of recurring model mistakes', 'Protect time to practise without the tool'], 9, ''),
        ],
        outro: 'If you try only one thing, pick the Monday rule: never merge what you cannot explain. Share this with the teammate who needs it.',
      },
    ],
    introOutro: {
      hooks: [
        { style: 'Question', text: 'What happens to a programming career when the first draft of every function is written by a machine?' },
        { style: 'Bold claim', text: 'The most valuable developer skill in the next five years is not writing code. It is knowing when the code in front of you is wrong.' },
        { style: 'Story', text: 'A junior developer told me she shipped a feature in an afternoon. Then she spent the next two days working out how it worked.' },
        { style: 'Statistic', text: 'A growing share of developers say they use an AI assistant every week [verify: cite a current survey and its date]. So who is still learning to code the hard way?' },
        { style: 'Cold open', text: 'Line one hundred and twelve. It compiles, it passes the tests, and it is quietly wrong. Let us talk about how that happens.' },
      ],
      intro_script:
        'Welcome to the show. Over the next forty-five minutes we will look at how AI coding assistants actually work, where they save real time, where they quietly cost you, and what it all means for your career. We start with a short history, then a framework you can use on Monday.',
      outros: [
        'That is our tour of AI coding assistants. Pick one habit from today, try it this week, and send us what you learn. Subscribe so you do not miss the follow-up.',
        'Thanks for listening. If this changed how you will review code tomorrow, share it with one teammate. We will be back next week with your questions.',
        'The tools will keep changing; the judgment is yours. Leave a review if this was useful, and tell us which segment you want to go deeper on.',
      ],
      teaser: 'AI writes the first draft now. What is left for you?',
    },
    comments: [
      { segmentId: 3, author: 'maya', body: 'Can we add one concrete example of a "confidently wrong" suggestion here? Listeners will remember a story.', minutesAgo: 190, resolved: false },
      { segmentId: 1, author: 'jordan', body: 'The timeline is tight for six minutes. Maybe trim the history to three beats.', minutesAgo: 75, resolved: true },
      { segmentId: null, author: 'sam', body: 'Love the structure overall. Should the guest come in before or after the framework segment?', minutesAgo: 20, resolved: false },
    ],
  },

  'true-crime': {
    research: {
      topic: [
        wiki('Cold case', 'An unsolved criminal investigation that is no longer actively pursued but may be reopened if new evidence appears.'),
        wiki('Missing person', 'Someone whose whereabouts are unknown and whose status as alive or dead cannot be confirmed.'),
        wiki('Forensic science', 'The application of scientific methods to matters of law and criminal investigation.'),
      ],
      1: [wiki('Talk radio', 'A radio format built around discussion and listener calls rather than music.'), wiki('Missing person', 'Someone whose whereabouts are unknown and whose status as alive or dead cannot be confirmed.')],
      2: [wiki('Missing person', 'Someone whose whereabouts are unknown and whose status as alive or dead cannot be confirmed.'), wiki('Eyewitness testimony', "A person's account of what they saw or heard, and the well-studied limits of memory it relies on.")],
      3: [wiki('Alibi', 'A claim that someone was elsewhere when a crime took place.'), wiki('Circumstantial evidence', 'Evidence that supports a conclusion only by inference rather than directly.')],
      4: [wiki('Confirmation bias', 'The tendency to favor information that confirms what one already believes.')],
      5: [wiki('DNA profiling', 'A technique for identifying individuals by characteristics of their DNA.'), wiki('Cold case', 'An unsolved criminal investigation that is no longer actively pursued but may be reopened if new evidence appears.')],
      6: [wiki('Confirmation bias', 'The tendency to favor information that confirms what one already believes.'), wiki('Circumstantial evidence', 'Evidence that supports a conclusion only by inference rather than directly.')],
    },
    pins: { 2: [1], 5: [0] },
    variations: [
      {
        approach: 'Suspect by suspect',
        rationale: 'Giving each person their own segment lets the audience play detective and weigh the evidence as it comes.',
        title: 'Four People Who Could Have Done It: The Dana Ferris Case',
        intro: 'Dana Ferris left the studio one night and never came home. Tonight we will meet every person who had a reason, and an opportunity, and decide for ourselves.',
        segments: [
          segment(1, 'The Night She Disappeared', ['The last broadcast and the final phone call', 'Who was in the building', 'What the first officers noted'], 8, 'Let us begin with the person closest to her.'),
          segment(2, 'The Co-Host', ['A public partnership and a private rift', 'The alibi and how it was checked', 'What the timeline leaves open'], 10, 'Then there is someone who left the station months earlier.'),
          segment(3, 'The Ex-Producer', ['A dispute over credit and contract terms', 'Where they said they were', 'Why detectives moved on'], 10, 'The next name only came up years later.'),
          segment(4, "The Engineer Nobody Asked", ["A technician's access to keys and recordings", 'The interview that was never followed up', 'What the tapes might still hold'], 11, 'And then, a discovery changed the question.'),
          segment(5, 'What We Still Do Not Know', ['The evidence that does not fit any theory', 'What a fresh review could test', 'How listeners can share information responsibly'], 11, ''),
        ],
        outro: 'If you have information, contact the investigating agency, not us. Thank you for listening with care.',
      },
      {
        approach: 'Timeline in reverse',
        rationale: 'Opening with the new discovery hooks the listener, then unwinding the case explains how anyone got here.',
        title: 'Working Backward: How a New Clue Reopened the Dana Ferris Case',
        intro: 'The case was quiet for years. Then something turned up. Today we begin with that discovery and work backward to the night it all started.',
        segments: [
          segment(1, 'The Discovery', ['What was found and where', 'Who confirmed it', 'Why it matters now'], 9, 'To understand it, we go back a few years.'),
          segment(2, 'The Case Goes Cold', ['How the investigation wound down', 'Leads that were never pursued', 'The family\'s campaign'], 10, 'Back further, to the first days.'),
          segment(3, 'The First 48 Hours', ['Decisions made in the opening search', 'Evidence that may have been missed', 'What experts say about that window'], 10, 'And finally, the night itself.'),
          segment(4, 'The Last Broadcast', ['The final show, minute by minute', 'The people around her that night', 'The call that never made air'], 11, 'So where does that leave us?'),
          segment(5, 'Weighing What Changed', ['Which theories the discovery strengthens', 'Which it weakens', 'What to watch for next'], 10, ''),
        ],
        outro: 'Cases like this reopen because someone kept asking. If this stayed with you, share it, and remember the person at the center.',
      },
    ],
    introOutro: {
      hooks: [
        { style: 'Question', text: 'What do you do when the last thing a missing woman ever said on air is the only clue anyone has?' },
        { style: 'Bold claim', text: 'The most important evidence in the Dana Ferris case was sitting on a shelf for years, and nobody asked for it.' },
        { style: 'Story', text: 'On the night she disappeared, the station played twelve minutes of dead air before anyone noticed she was gone.' },
        { style: 'Statistic', text: 'Only a fraction of long-unsolved cases are ever reopened [verify: cite a figure from a reliable source]. This is one of them.' },
        { style: 'Cold open', text: 'Static. A chair pushed back. Then the studio door. This is the last recording of Dana Ferris.' },
      ],
      intro_script:
        'Welcome back. This episode is a careful look at what is known, what is claimed, and what is still missing in the disappearance of Dana Ferris. We will keep facts and theories separate, and we will tell you which is which.',
      outros: [
        'If you know something, please contact the investigating agency. Thank you for listening with care, and subscribe for the next case file.',
        'The case is still open. Share this episode with someone who follows cold cases, and leave a review to help others find it.',
        'We will keep following the story as it develops. Until then, remember the person at the center of it.',
      ],
      teaser: 'Twelve minutes of dead air, and a case that never closed.',
    },
    comments: [
      { segmentId: 4, author: 'jordan', body: 'We should double-check the engineer claim against the source before we air it.', minutesAgo: 240, resolved: false },
      { segmentId: 2, author: 'maya', body: 'This is where I would add a sound cue for the timeline.', minutesAgo: 95, resolved: true },
      { segmentId: null, author: 'sam', body: 'Legal wants a read-through of the suspect segments before recording.', minutesAgo: 30, resolved: false },
    ],
  },

  motivational: {
    research: {
      topic: [
        wiki('Occupational burnout', 'A state of emotional, physical and mental exhaustion linked to long-term stress at work.'),
        wiki('Maslach Burnout Inventory', 'A widely used questionnaire for measuring burnout.'),
        wiki('Self-determination theory', 'A theory of human motivation built on autonomy, competence and relatedness.'),
      ],
      1: [wiki('Occupational burnout', 'A state of emotional, physical and mental exhaustion linked to long-term stress at work.'), wiki('Maslach Burnout Inventory', 'A widely used questionnaire for measuring burnout.')],
      2: [wiki('Stress (biology)', "The body's response to a demand or threat, and what happens when it never switches off.", 'Stress_(biology)'), wiki('Occupational burnout', 'A state of emotional, physical and mental exhaustion linked to long-term stress at work.')],
      3: [wiki('Work–life balance', 'How people divide time and energy between paid work and the rest of life.', 'Work%E2%80%93life_balance'), wiki('Sleep hygiene', 'Habits and practices that support regular, good-quality sleep.')],
      4: [wiki('Self-determination theory', 'A theory of human motivation built on autonomy, competence and relatedness.')],
      5: [wiki('Habit', 'A routine behavior that is repeated regularly and tends to occur without much thought.'), wiki('Sleep hygiene', 'Habits and practices that support regular, good-quality sleep.')],
    },
    pins: { 1: [0] },
    variations: [
      {
        approach: 'Problem and solution',
        rationale: 'Burned-out listeners want relief fast, so naming the problem and moving straight to what helps respects their energy.',
        title: 'Burnout: What It Is and the Smallest Way Out',
        intro: 'If you are tired in a way sleep does not fix, this episode is for you. We will name what is happening, then focus on the smallest steps that help.',
        segments: [
          segment(1, 'What Is Actually Happening', ['Exhaustion, cynicism and a sense of ineffectiveness', 'Why it is not laziness', 'How to tell it from ordinary tiredness'], 7, 'Once you can name it, you can start to change it.'),
          segment(2, 'Why the Usual Fixes Fall Short', ['A weekend away treats the symptom, not the load', 'The role of workload, control and fairness', 'What to change first'], 7, 'So what works instead?'),
          segment(3, 'Recover the Basics', ['Sleep, food and movement as a floor, not a project', 'Setting one boundary you can keep', 'Asking for one specific kind of help'], 7, 'With the floor in place, look at meaning.'),
          segment(4, 'Rebuild Meaning', ['What used to feel worth doing', 'One small piece of work you control', 'Talking to someone who has done it'], 7, 'Finally, keep it going.'),
          segment(5, 'Keep It Going', ['A weekly check-in with yourself', 'Early warning signs to watch for', 'When to seek professional support'], 7, ''),
        ],
        outro: 'Pick the smallest step from today and do it once. If burnout is severe, please reach out to a health professional.',
      },
      {
        approach: 'Myth-busting',
        rationale: 'Correcting the beliefs that keep people stuck, like "just push through", is the most useful thing a motivational episode can do.',
        title: 'Four Burnout Myths That Keep You Stuck',
        intro: 'Push harder. Take a vacation. Just be grateful. We have all heard the advice, and it often makes things worse. Let us test the myths.',
        segments: [
          segment(1, 'Myth: Pushing Through Works', ['Why more effort on empty makes output worse', 'What recovery actually requires', 'A better question than "how do I push?"'], 7, 'Another common one is the vacation.'),
          segment(2, 'Myth: A Vacation Will Fix It', ['The relief that fades by Wednesday', 'What has to change on return', 'Small daily recovery beats one big break'], 7, 'Then there is guilt.'),
          segment(3, 'Myth: You Are Just Not Resilient', ['Burnout as a response to conditions', 'What is and is not in your control', 'Where to push back at work'], 7, 'And the last myth is that it is permanent.'),
          segment(4, 'Myth: It Never Gets Better', ['A real comeback, step by step', 'What recovery tends to look like week to week', 'Why progress is uneven'], 7, 'So what do you do first?'),
          segment(5, 'Your First Move', ['Choose one boundary', 'Choose one person to tell', 'Choose one thing to stop this week'], 7, ''),
        ],
        outro: 'You do not have to fix everything. Choose one move from today and try it this week. Share this with someone who needs it.',
      },
    ],
    introOutro: {
      hooks: [
        { style: 'Question', text: 'When did you last feel rested, not just less tired?' },
        { style: 'Bold claim', text: 'Burnout is not a personal failing. It is what happens when the demands never stop and the recovery never starts.' },
        { style: 'Story', text: 'She was the person everyone relied on. On a Tuesday morning she sat in the car outside the office for forty minutes and could not open the door.' },
        { style: 'Statistic', text: 'Surveys keep finding that large numbers of workers report burnout symptoms [verify: cite a recent survey and its date]. If that is you, you are not alone.' },
        { style: 'Cold open', text: 'The alarm goes off. You are already tired. Let us talk about why, and about the first small thing that helps.' },
      ],
      intro_script:
        'Welcome to the show. Today is about coming back from burnout, not just getting rested. We will name what is happening, look at why it builds, hear one real comeback, and leave you with three moves you can make this week.',
      outros: [
        'Take one thing from today and try it this week. If this helped, share it with someone who is quietly struggling, and subscribe for more.',
        'Recovery is uneven, and that is normal. Be patient with yourself, and if things feel severe, please talk to a health professional.',
        'Thank you for listening. Leave a review to help others find the show, and tell us which move you are trying first.',
      ],
      teaser: 'Come back stronger, not just rested.',
    },
    comments: [
      { segmentId: 4, author: 'maya', body: 'Do we have permission to use the comeback story with a real name? Otherwise, change it to a composite.', minutesAgo: 320, resolved: false },
      { segmentId: 5, author: 'sam', body: 'The three moves are great. Can we give each one a time estimate?', minutesAgo: 60, resolved: true },
      { segmentId: null, author: 'jordan', body: 'Add a line about seeking professional support in the outro. Important for this topic.', minutesAgo: 15, resolved: false },
    ],
  },
};
