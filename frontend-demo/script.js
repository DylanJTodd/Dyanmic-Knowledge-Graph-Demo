// script.js
import { toolRegistry, toolSchemas } from './tools.js';
import { getGraphDict, exportGraphJson, getGraphDiff, getNodeHistory } from './user_tools.js';

const firstPrompt = `...`;
const first5Prompt = `...`;
const secondPrompt = `...`;

let prompt1History = [];
let prompt2History = [];
let prompt15History = [];
let lastGraphDiff = null;
let toolCallLog = [];

function getApiKey() {
  const key = localStorage.getItem("OPENAI_API_KEY");
  if (!key || !key.startsWith("sk-")) {
    throw new Error("Missing or invalid API key in localStorage");
  }
  return key;
}

async function callOpenAI(messages, tools = [], temperature = 0.7) {
  const apiKey = getApiKey();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
      temperature,
      max_tokens: 2048,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("OpenAI API error:", json);
    throw new Error(`OpenAI error: ${json.error?.message || res.status}`);
  }
  return json;
}

async function runPrompt1(userInput) {
  const prevGraph = getGraphDict();
  const systemGraphInfo = lastGraphDiff
    ? `Graph diff: ${JSON.stringify(lastGraphDiff, null, 2)}`
    : `Graph dump: ${exportGraphJson()}`;

  const messages = [
    { role: "system", content: firstPrompt },
    ...prompt1History,
    { role: "system", content: systemGraphInfo },
    { role: "user", content: userInput },
  ];

  const result = await callOpenAI(
    messages,
    Object.values(toolSchemas).map((schema) => ({
      type: "function",
      function: {
        name: schema.name,
        description: schema.description,
        parameters: schema.parameters,
      },
    }))
  );

  const msg = result.choices[0].message;
  prompt1History.push(
    { role: "user", content: userInput },
    { role: "assistant", content: msg.content || "" }
  );

  toolCallLog = [];
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      const fnName = tc.function.name;
      const args = JSON.parse(tc.function.arguments);
      if (fnName in toolRegistry) {
        const result = toolRegistry[fnName](args);
        toolCallLog.push({ tool: fnName, args, result });
      }
    }
  }

  const currentGraph = getGraphDict();
  lastGraphDiff = getGraphDiff(prevGraph, currentGraph);
  return msg.content || "(No content)";
}

async function runPrompt15(userInput) {
  const prevGraph = getGraphDict();
  const fullGraph = exportGraphJson();

  const messages = [
    { role: "system", content: first5Prompt },
    { role: "system", content: userInput },
    { role: "system", content: prompt1History[prompt1History.length - 1]?.content || "" },
    { role: "system", content: "GRAPH_CONSISTENCY_PASS" },
    {
      role: "system",
      content:
        `You are now performing a graph consistency check.\nBelow is the full belief graph.\nDetect contradictions, redundancies, and opportunities to add or remove edges or nodes.\nUse tool calls to fix the graph. Then articulate what changes you made, why, and the emotional justifications for it.\n\n${fullGraph}`,
    },
    { role: "user", content: "Begin graph consistency cleanup with explanation now." },
  ];

  const result = await callOpenAI(
    messages,
    Object.values(toolSchemas).map((schema) => ({
      type: "function",
      function: {
        name: schema.name,
        description: schema.description,
        parameters: schema.parameters,
      },
    })),
    0.3
  );

  const msg = result.choices[0].message;
  toolCallLog = [];

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      const fnName = tc.function.name;
      const args = JSON.parse(tc.function.arguments);
      if (fnName in toolRegistry) {
        const result = toolRegistry[fnName](args);
        toolCallLog.push({ tool: fnName, args, result });
      } else {
        console.log(`\n[Prompt 1.5 Unknown tool: ${fnName}]`);
      }
    }
  }

  const currentGraph = getGraphDict();
  lastGraphDiff = getGraphDiff(prevGraph, currentGraph);

  prompt15History.push({ role: "assistant", content: msg.content || "" });
  return msg.content || "(No content)";
}

async function runPrompt2(reasoningResult, lastUserMsg) {
  const fullGraph = exportGraphJson();
  const nodeHistory = getNodeHistory();
  const toolSummary = toolCallLog
    .map((c) => `- \`${c.tool}\` with ${JSON.stringify(c.args)}`)
    .join("\n");

  const messages = [
    { role: "system", content: secondPrompt },
    {
      role: "system",
      content: `Recent graph diff or dump:\n${lastGraphDiff ? JSON.stringify(lastGraphDiff, null, 2) : fullGraph}`,
    },
    { role: "system", content: `Recent tool calls:\n${toolSummary}` },
    {
      role: "system",
      content: `PROMPT_1_REASONING_START\n${reasoningResult}\nPROMPT_1_REASONING_END`,
    },
    { role: "system", content: `Node history:\n${JSON.stringify(nodeHistory, null, 2)}` },
    { role: "user", content: lastUserMsg },
    ...prompt2History.slice(-1),
  ];

  const result = await callOpenAI(messages);
  const content = result.choices[0].message.content;
  prompt2History.push({ role: "assistant", content });
  return content;
}

export async function handleUserInput(userInput) {
  const reasoning = await runPrompt1(userInput);
  const justification = await runPrompt15(userInput);
  const reflection = await runPrompt2(`${reasoning}\n\n${justification}`, userInput);
  return {
    userInput,
    prompt1: reasoning,
    prompt1_5: justification,
    reflection,
    toolCalls: toolCallLog,
    graph: getGraphDict(),
  };
}
