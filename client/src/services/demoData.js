// Bundled sample outlines so the app is fully explorable with zero setup
// and no GEMINI_API_KEY -- "Try a demo" loads one of these directly into
// app state instead of calling the backend. The same three outlines are
// exported as scripts under sample-output/ (see scripts/buildSampleOutput.js).

export const demoOutlines = [
  {
    id: 'tech',
    label: 'Tech: AI Coding Assistants',
    outline: {
      episode_title: 'How AI Coding Assistants Are Rewiring Software Careers',
      tone: 'Educational',
      total_duration_mins: 45,
      intro:
        "Six months ago, writing a function meant typing every line yourself. Today, a growing share of developers describe their code as co-written with an AI. In the next 45 minutes, we're breaking down how these tools actually work, where they help, where they quietly hurt you, and what it means for anyone building a career in software right now.",
      segments: [
        {
          id: 1,
          title: 'From Autocomplete to Autonomous Agents',
          talking_points: [
            'Trace the lineage: basic autocomplete, GitHub Copilot in 2021, chat-based assistants, and now agentic tools that can open files, run commands, and iterate on their own',
            'Explain the core technique -- large language models trained on public code plus reinforcement learning from human coder feedback',
            "Contrast 'suggests the next line' tools with 'plans and executes a multi-file change' tools, since listeners often conflate the two",
            'Note the speed of the shift: three product categories emerged in under four years',
          ],
          duration_mins: 6,
          transition: "That history explains what these tools ARE. Now let's talk about what they're actually good at.",
        },
        {
          id: 2,
          title: 'Where They Genuinely Save Time',
          talking_points: [
            'Boilerplate and glue code: API clients, config files, test scaffolding -- the tedious 20% that rarely needs creativity',
            'Reading unfamiliar codebases faster by asking the assistant to summarize a module before diving in',
            'Turning a vague bug report into a first hypothesis by pointing the assistant at the stack trace',
            'Translating between languages or frameworks, e.g. porting a Python script to TypeScript',
          ],
          duration_mins: 8,
          transition: "Those are real wins. But there's a flip side that doesn't get talked about enough.",
        },
        {
          id: 3,
          title: 'The Hidden Costs: Skill Atrophy and Silent Bugs',
          talking_points: [
            "Junior developers who lean on AI for logic they don't understand yet, and what that does to debugging skills a year later",
            'Confidently wrong code: assistants that produce plausible-looking but subtly incorrect logic, especially around edge cases and concurrency',
            'Security concerns -- models trained on public repos can reproduce insecure patterns (hardcoded secrets, SQL injection-prone queries)',
            "The 'review fatigue' problem: when 80% of a PR is AI-generated, human reviewers start rubber-stamping",
          ],
          duration_mins: 8,
          transition: "So how should a working developer actually use these tools without falling into those traps?",
        },
        {
          id: 4,
          title: 'A Practical Framework for Using AI Assistants Well',
          talking_points: [
            "Rule of thumb: use AI to go from zero to a draft, never to skip understanding the draft you ship",
            'Always ask the assistant to explain its own reasoning before accepting a nontrivial change',
            'Treat AI-generated tests with suspicion -- verify they actually fail before the fix and pass after',
            'Keep a personal list of mistakes the assistant has made for you, and re-check for those patterns specifically',
          ],
          duration_mins: 8,
          transition: "That's the individual-developer view. Zoom out, and this is reshaping entire teams and hiring pipelines.",
        },
        {
          id: 5,
          title: 'What This Means for Hiring and Team Structure',
          talking_points: [
            'Interview formats shifting away from pure algorithm puzzles toward code review and debugging exercises',
            'Smaller teams shipping more -- what a 4-person startup can now build that used to need 12 people',
            'The growing premium on system design and architecture skills, since AI is weaker at whole-system tradeoffs than at local code',
            'Early evidence on junior hiring: some companies hiring fewer juniors, others betting junior-plus-AI is a training accelerator',
          ],
          duration_mins: 8,
          transition: "Let's bring this back to something concrete: what should a developer listening right now actually do this month?",
        },
        {
          id: 6,
          title: "Your Move: Building an AI-Complementary Skill Set",
          talking_points: [
            'Double down on the things AI is still bad at: system design, cross-team communication, judgment calls under ambiguity',
            'Practice writing precise, specific prompts as a skill in itself -- vague prompts produce vague code',
            'Keep at least one project where you deliberately code without assistance, to keep your unaided skills sharp',
            'Where to start experimenting this week without a big commitment',
          ],
          duration_mins: 7,
          transition: "Let's wrap up with the big picture.",
        },
      ],
      guest_questions: [
        'You shipped one of the first AI coding assistants used at scale -- what surprised you most about how developers actually used it, versus how you expected them to?',
        'What is the single most common mistake you see developers make when they start relying on AI assistants?',
        "Do you think today's junior developers are learning differently -- worse, better, or just different -- than developers did ten years ago?",
        'Where does the current generation of AI coding tools completely fall apart?',
        'If you were mentoring a junior developer today, what would you tell them to deliberately practice without AI help?',
        "Five years from now, what's one part of the software job that you're confident AI still won't touch?",
      ],
      outro:
        "That's a wrap on how AI coding assistants are reshaping the way we build software. If one thing stuck with you today, let it be this: these tools are extraordinary at generating code, but understanding what that code does is still entirely on you. Subscribe if you want more episodes untangling how AI is changing technical careers, and send us the tool you can't stop arguing about with your team.",
    },
  },
  {
    id: 'true-crime',
    label: 'True Crime: The Vanishing Radio Host',
    outline: {
      episode_title: 'The Vanishing Radio Host: What Really Happened to Dana Ferris?',
      tone: 'Investigative',
      total_duration_mins: 50,
      intro:
        'On a foggy Tuesday morning in 1997, late-night radio host Dana Ferris signed off her show at 2 a.m. and was never seen again. No body, no confirmed sighting, and a case file that police quietly closed nine years later. Tonight we walk through the timeline, the four suspects investigators never fully cleared, and a piece of evidence that resurfaced just last year and reopened the question everyone thought was settled.',
      segments: [
        {
          id: 1,
          title: 'The Last Broadcast',
          talking_points: [
            'Reconstruct the final hour of Dana Ferris\'s show from the station\'s surviving call logs and a surviving cassette recording',
            "Note the strange, unscheduled call she took at 1:42 a.m. that station staff couldn't later identify",
            'Describe the parking lot she walked to alone every night, and why station management had flagged it as unsafe six months earlier',
            'Establish the exact last-confirmed-sighting timestamp: 2:07 a.m., by a gas station clerk two blocks away',
          ],
          duration_mins: 7,
          transition: 'That gas station sighting is the last confirmed trace of her. Everything after that is reconstruction.',
        },
        {
          id: 2,
          title: 'The First 48 Hours -- and What Went Wrong',
          talking_points: [
            'Police didn\'t open a missing-persons file until 36 hours had passed, citing her history of unannounced trips',
            "Her apartment was never sealed as a scene until day four, by which point her sister had already been inside cleaning",
            'The original detective\'s notes, obtained via records request, show he considered it a voluntary disappearance almost immediately',
            'Contrast this with the department\'s own missing-persons protocol at the time, which called for scene preservation within 24 hours',
          ],
          duration_mins: 9,
          transition: 'Those early mistakes mean a lot of physical evidence is simply gone. So the case leans heavily on people -- starting with who had a motive.',
        },
        {
          id: 3,
          title: 'Suspect One and Two: The Co-Host and the Ex-Producer',
          talking_points: [
            'Her longtime co-host had been quietly pushed out of a joint contract renewal two weeks prior',
            'The ex-producer had a restraining order filed against him by a different woman just eight months later',
            'Both had alibis that check out on paper but rely entirely on each other as witnesses',
            'A financial detail: Dana had recently discovered a discrepancy in show sponsorship payments routed through the producer',
          ],
          duration_mins: 9,
          transition: "Neither of them was ever charged. But there's a third name that appears in the file far less often than it should.",
        },
        {
          id: 4,
          title: 'The Overlooked Suspect: A Station Engineer\'s Story',
          talking_points: [
            "The overnight engineer's shift log shows he clocked out 40 minutes before his usual time that night, unexplained",
            'He was interviewed once, for eleven minutes, and never re-contacted despite inconsistencies in his statement',
            "A coworker's account, never entered into the official file, describes tension between him and Dana over a canceled segment",
            'Why investigators today believe this lead was under-pursued, and what re-interviewing him decades later might reveal',
          ],
          duration_mins: 8,
          transition: 'For years, that was where the trail went cold. Then, last spring, something changed.',
        },
        {
          id: 5,
          title: 'The 2025 Discovery That Reopened the Case',
          talking_points: [
            'A storage unit auction turned up a box of station archives, including a second, previously unknown recording from that night',
            'Forensic audio analysis identifies a second voice in the background of the recording, not previously in any suspect list',
            'The current department\'s renewed statement, and why they\'re treating this as an active reinvestigation rather than a cold case footnote',
            'What forensic genealogy techniques -- unavailable in 1997 -- could now do with evidence that was preserved',
          ],
          duration_mins: 9,
          transition: 'All of this brings us to tonight\'s guest, who worked adjacent to this case for over a decade.',
        },
        {
          id: 6,
          title: 'Weighing the Theories',
          talking_points: [
            'Lay out the three leading theories side by side: co-host/producer conspiracy, engineer confrontation gone wrong, and a stranger abduction',
            'Which theory the surviving physical evidence actually supports best, and which it rules out',
            'Address the persistent audience theory that Dana staged her own disappearance, and why the financial and behavioral evidence argues against it',
            'What would need to be true for this case to ever reach a courtroom after 28 years',
          ],
          duration_mins: 8,
          transition: 'Before we close, let\'s hear directly from someone who spent years around the edges of this investigation.',
        },
      ],
      guest_questions: [
        "You reviewed the original case file for your reporting -- what's the one detail in there that other outlets have consistently missed?",
        'When you interviewed people who knew Dana, was there a name that came up more than the official suspect list would suggest?',
        'How reliable is 28-year-old forensic audio evidence in a case like this, in your experience?',
        'Departments often resist reopening cases that were effectively closed -- what changed here?',
        'If you had to bet on one of the three leading theories, which one, and why?',
        'What would meaningful justice even look like for this family after almost three decades?',
      ],
      outro:
        "That's where the case stands tonight: reopened, but far from resolved. If you have information related to the disappearance of Dana Ferris, the tip line in our show notes is monitored directly by investigators. Follow the show so you don't miss part two, where we go inside the new forensic analysis. Until then, stay curious, and stay careful.",
    },
  },
  {
    id: 'motivational',
    label: 'Motivational: Rebuilding After Burnout',
    outline: {
      episode_title: 'Rebuilding After Burnout: How to Come Back Stronger, Not Just Rested',
      tone: 'Motivational',
      total_duration_mins: 35,
      intro:
        "If you've ever hit a point where even opening your laptop felt physically heavy, this episode is for you. Burnout isn't a productivity problem you can fix with a long weekend -- it's a full system reset. Today we're talking through what burnout actually does to you, why the usual advice falls short, and a real comeback story from someone who rebuilt their career from the ground up.",
      segments: [
        {
          id: 1,
          title: "Naming It: What Burnout Actually Is",
          talking_points: [
            "Distinguish burnout from ordinary tiredness: chronic exhaustion, cynicism, and a collapse in your sense of effectiveness",
            'Why burnout often shows up as irritability and numbness before it shows up as visible exhaustion',
            "The trap of pushing through, since burnout responds to rest the way a broken bone responds to a jog",
          ],
          duration_mins: 6,
          transition: "Once you can name it, the next question is: how did you actually get here?",
        },
        {
          id: 2,
          title: 'The Slow Slide: How Burnout Actually Builds',
          talking_points: [
            'The gap between how much you\'re giving and how much control you feel you have over your own work',
            "Chronic small overcommitments that each felt reasonable in isolation",
            "The identity trap of tying your entire sense of worth to output and achievement",
            "How isolation quietly accelerates burnout, since struggling alone removes your early warning system",
          ],
          duration_mins: 7,
          transition: "Recognizing the slide is step one. Recovering from it is where most advice actually fails people.",
        },
        {
          id: 3,
          title: "Why 'Just Take a Vacation' Doesn't Work",
          talking_points: [
            'A week off addresses fatigue, not the underlying mismatch between demands and control that caused it',
            'The rebound effect: many people return from a break and burn out again within months because nothing structural changed',
            'What actually needs to change: boundaries, workload, or the story you tell yourself about your own worth',
            'Rest as the first step of a longer process, not the whole process',
          ],
          duration_mins: 8,
          transition: "So what does real recovery look like? Let's bring in someone who's actually lived it.",
        },
        {
          id: 4,
          title: 'A Real Comeback: From Burned Out to Rebuilt',
          talking_points: [
            "Walk through the guest's lowest point and the specific moment they realized something had to change",
            'The concrete first step they took, and why it was smaller than most people would expect',
            'What their support system looked like during the hardest stretch, and who they leaned on',
            'How their definition of success looks different now than it did before burnout hit',
          ],
          duration_mins: 7,
          transition: "That story gives us a real blueprint. Let's turn it into something the listener can actually use this week.",
        },
        {
          id: 5,
          title: "Your First Three Moves This Week",
          talking_points: [
            'Move one: identify a single non-negotiable boundary you can set in the next 48 hours',
            'Move two: tell one person the truth about how you\'re actually doing, not the polished version',
            'Move three: schedule one hour that has no productive purpose at all, and protect it like a meeting',
            'A reminder that rebuilding is not linear, and a setback next week does not erase progress made this week',
          ],
          duration_mins: 7,
          transition: "Let's close with the thought I want you to carry with you.",
        },
      ],
      guest_questions: [
        "Take us back to the moment you knew something had to change -- what did that actually look like day to day?",
        'What is one piece of well-meaning advice you got during your burnout that turned out to be unhelpful?',
        'Who or what made the biggest difference in your recovery, and how did you find them?',
        "How is your relationship to work different now, a year on, compared to before?",
        "If someone listening is in the middle of burnout right now, what's the one thing you'd want them to hear?",
      ],
      outro:
        "Burnout can make you feel like the version of you that could handle everything is gone for good. It isn't -- it's just waiting for conditions that actually let it recover. If this episode gave you even one thing to try this week, that's a win. Share it with someone who needs to hear it today, and we'll see you next time.",
    },
  },
];

export function getDemoOutline(id) {
  return demoOutlines.find((demo) => demo.id === id) ?? demoOutlines[0];
}
