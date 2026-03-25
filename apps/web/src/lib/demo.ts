/**
 * Demo-данные и mock-ответы для работы без backend.
 * Будут заменены реальными API-вызовами при подключении backend.
 */

import type { ScenarioContext } from "@/store/chatStore";

export function getWelcomeMessage(companion: string): string {
  switch (companion) {
    case "Alex":
      return "Hey! Saw this and thought of you. What do you think? Are you using Rust at work?";
    case "Sam":
      return "Hi there! What's up? Let's chat about something interesting!";
    case "Morgan":
      return "Hello! I'm here to help you improve your English. Feel free to speak about anything on your mind.";
    default:
      return "Hey! Ready to practice? What's on your mind?";
  }
}

export function getScenarioWelcomeMessage(
  companion: string,
  scenario: ScenarioContext
): string {
  const greetings: Record<string, Record<string, string>> = {
    "daily-standup": {
      Alex: "Good morning! Let's start the standup. What did you work on yesterday?",
      Sam: "Hey team! Ready for standup? What's the update?",
      Morgan: "Morning! Take your time and share what you've been working on.",
    },
    "code-review": {
      Alex: "I've looked at your PR. Let's discuss the changes you made.",
      Sam: "Nice PR! Let's walk through it together.",
      Morgan: "I see you've submitted a PR. Let's review it step by step.",
    },
    "tech-demo": {
      Alex: "The stakeholders are ready. Please begin your demo.",
      Sam: "Alright, show us what you've built!",
      Morgan: "Whenever you're ready, walk us through the feature.",
    },
    "job-interview": {
      Alex: "Thanks for joining. Let's start with a system design question.",
      Sam: "Welcome! Let's have a chat about your experience.",
      Morgan: "Hello! I'd like to learn about your approach to problem-solving.",
    },
    "sprint-planning": {
      Alex: "Let's review the backlog. What can we commit to this sprint?",
      Sam: "Planning time! What looks doable this sprint?",
      Morgan: "Let's discuss priorities and realistic estimates.",
    },
    "slack-message": {
      Alex: "What message do you need to write? I'll help make it sound natural.",
      Sam: "Need help with a message? Let me know what you're trying to say!",
      Morgan: "Tell me what you want to communicate, and I'll suggest natural phrasing.",
    },
  };

  return greetings[scenario.id]?.[companion]
    || `Let's begin the ${scenario.name} scenario.`;
}

export function getDemoReconstruction(text: string) {
  const demoExamples: Record<string, ReturnType<typeof getDemoReconstruction>> = {
    "i work on deployment pipeline": {
      reconstruction: {
        corrected: "I've been working on the deployment pipeline",
        original_intent: "i work on deployment pipeline",
        main_error: "Missing article and tense",
        error_type: "grammar" as const,
        explanation: "Present perfect continuous sounds more natural for ongoing work. Also 'the' is needed before 'deployment pipeline'.",
      },
      variants: {
        simple: "I'm working on the deployment pipeline",
        professional: "I've been optimizing our CI/CD pipeline infrastructure",
        colloquial: "Yeah, been messing with the deployment stuff",
        slang: "Been hacking on the pipeline, you know",
        idiom: "I've been burning the midnight oil on our deployment",
      },
    },
    "i fix баг in authentication": {
      reconstruction: {
        corrected: "I fixed a bug in the authentication system",
        original_intent: "i fix баг in authentication",
        main_error: "Code-switching (RU→EN) and tense",
        error_type: "code_switching" as const,
        explanation: "'Баг' → 'bug'. Past simple 'fixed' is better than present for completed work.",
      },
      variants: {
        simple: "I fixed a bug in authentication",
        professional: "I resolved an authentication issue in our system",
        colloquial: "Just squashed a bug in auth",
        slang: "Nuked that auth bug finally",
        idiom: "I got to the bottom of that auth problem",
      },
    },
  };

  const lowerText = text.toLowerCase().trim();
  if (demoExamples[lowerText]) {
    return demoExamples[lowerText];
  }

  const corrected = text.charAt(0).toUpperCase() + text.slice(1) +
    (text.endsWith(".") || text.endsWith("!") || text.endsWith("?") ? "" : ".");

  if (corrected === text) {
    return {
      reconstruction: {
        corrected: text,
        original_intent: text,
        main_error: null,
        error_type: "none" as const,
        explanation: null,
      },
      variants: {
        simple: text,
        professional: `From a professional perspective, ${text.toLowerCase().replace(/\.$/, "")}`,
        colloquial: `Yeah, ${text.toLowerCase().replace(/\.$/, "")}`,
        slang: `${text.replace(/\.$/, "")}, you know`,
        idiom: `To put it simply, ${text.toLowerCase().replace(/\.$/, "")}`,
      },
    };
  }

  return {
    reconstruction: {
      corrected,
      original_intent: text,
      main_error: "Capitalization and punctuation",
      error_type: "grammar" as const,
      explanation: "Sentences should start with a capital letter and end with proper punctuation.",
    },
    variants: {
      simple: corrected,
      professional: `To elaborate, ${corrected.toLowerCase().replace(/\.$/, "")}`,
      colloquial: `So basically, ${corrected.toLowerCase().replace(/\.$/, "")}`,
      slang: `Like, ${corrected.toLowerCase().replace(/\.$/, "")}, right?`,
      idiom: `In a nutshell, ${corrected.toLowerCase().replace(/\.$/, "")}`,
    },
  };
}

export function getCompanionResponse(companion: string): string {
  const responses = {
    Alex: [
      "That's a valid point. Can you elaborate on that?",
      "Interesting approach. How does that work in practice?",
      "I see what you mean. Let me know if you need any clarification.",
      "Got it! That's a common challenge with async Rust. Are you using Tokio? That usually solves most runtime issues.",
    ],
    Sam: [
      "Cool! That sounds really interesting, tell me more!",
      "Nice one! I've been curious about that too.",
      "Ha, I totally get it. What happened next?",
    ],
    Morgan: [
      "Great try! That's a good way to express it.",
      "I understand. Let me suggest a slightly different phrasing.",
      "You're making progress! Keep practicing.",
    ],
  };

  const companionResponses = responses[companion as keyof typeof responses] || responses.Alex;
  return companionResponses[Math.floor(Math.random() * companionResponses.length)];
}
