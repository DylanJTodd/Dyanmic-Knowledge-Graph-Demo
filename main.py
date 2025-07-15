import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from api import tools, user_api


# ────────────────────────────  ENV  ────────────────────────────
load_dotenv()
API_KEY        = os.getenv("OPENAI_API_KEY")
FIRST_PROMPT   = os.getenv("SYSTEM_PROMPT_1")
SECOND_PROMPT  = os.getenv("SYSTEM_PROMPT_2")

if not API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment")
if not FIRST_PROMPT or not SECOND_PROMPT:
    raise ValueError("Missing prompt(s) in environment")

# ────────────────────────  OPENAI CLIENT  ──────────────────────
client = OpenAI(api_key=API_KEY)
function_schemas = [
    {"type": "function", "function": schema}
    for schema in tools.tool_schemas.values()
]

# ─────────────────────  CONVERSATION STATE  ────────────────────
prompt1_history: list       = []
prompt2_history: list       = []
last_graph_diff: dict | None = None
tool_call_log: list         = []

# ──────────────────────────  PROMPT 1  ─────────────────────────
def run_prompt1(user_input: str) -> str:
    global last_graph_diff, tool_call_log

    prev_graph = user_api.get_graph_dict()

    system_graph_info = (
        f"Graph diff: {json.dumps(last_graph_diff, indent=2)}"
        if last_graph_diff
        else f"Graph dump: {user_api.export_graph_json()}"
    )

    prompt1_input = [
        {"role": "system", "content": FIRST_PROMPT},
        *prompt1_history,
        {"role": "system", "content": system_graph_info},
        {"role": "user",   "content": user_input}
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=prompt1_input,
        tools=function_schemas,
        tool_choice="auto",
        temperature=0.7,
        max_tokens=2048,
    )

    msg = response.choices[0].message

    prompt1_history.extend([
        {"role": "user",      "content": user_input},
        {"role": "assistant", "content": msg.content or ""}
    ])

    tool_call_log = []

    if msg.tool_calls:
        for tc in msg.tool_calls:
            fn_name = tc.function.name
            args    = json.loads(tc.function.arguments)
            if fn_name in tools.tool_registry:
                result = tools.tool_registry[fn_name](**args)
                tool_call_log.append(
                    {"tool": fn_name, "args": args, "result": result}
                )
                print(f"\n[Tool `{fn_name}` Result]: {result}")
            else:
                print(f"\n[Unknown tool: {fn_name}]")

    current_graph   = user_api.get_graph_dict()
    last_graph_diff = user_api.get_graph_diff(prev_graph, current_graph)

    return msg.content or "(No content)"

# ──────────────────────────  PROMPT 1.5  ─────────────────────────
def run_prompt1_5() -> str:
    global last_graph_diff, tool_call_log

    prev_graph = user_api.get_graph_dict()
    full_graph = user_api.export_graph_json()

    prompt_input = [
        {"role": "system", "content": FIRST_PROMPT},
        {"role": "system", "content": "GRAPH_CONSISTENCY_PASS"},
        {"role": "system", "content":
            "You are now performing a graph consistency check. "
            "Below is the full belief graph. "
            "Detect contradictions, redundancies, and opportunities to add or remove edges or nodes. "
            "Use tool calls to fix the graph. Return a brief summary of what was changed.\n\n"
            + full_graph},
        {"role": "user", "content": "Begin graph consistency cleanup now."}  # 👈 Required for model to actually respond
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=prompt_input,
        tools=function_schemas,
        tool_choice="auto",
        temperature=0.3,
        max_tokens=2048,
    )

    msg = response.choices[0].message
    tool_call_log = []

    if msg.tool_calls:
        for tc in msg.tool_calls:
            fn_name = tc.function.name
            args    = json.loads(tc.function.arguments)
            if fn_name in tools.tool_registry:
                result = tools.tool_registry[fn_name](**args)
                tool_call_log.append(
                    {"tool": fn_name, "args": args, "result": result}
                )
                print(f"\n[Prompt 1.5 Tool `{fn_name}` Result]: {result}")
            else:
                print(f"\n[Prompt 1.5 Unknown tool: {fn_name}]")

    current_graph   = user_api.get_graph_dict()
    last_graph_diff = user_api.get_graph_diff(prev_graph, current_graph)

    return msg.content or "(No content)"
# ──────────────────────────  PROMPT 2  ─────────────────────────
def run_prompt2(reasoning_result: str, last_user_msg: str) -> str:
    full_graph   = user_api.export_graph_json()
    tool_summary = "\n".join(
        f"- `{c['tool']}` with {json.dumps(c['args'])}"
        for c in tool_call_log
    )

    messages = [
        {"role": "system", "content": SECOND_PROMPT},
        {"role": "system", "content":
            f"Recent graph diff or dump:\n"
            f"{json.dumps(last_graph_diff, indent=2) if last_graph_diff else full_graph}"},
        {"role": "system", "content": f"Recent tool calls:\n{tool_summary}"},
        {"role": "system", "content": f"PROMPT_1_REASONING_START\n{reasoning_result}\nPROMPT_1_REASONING_END"},
        {"role": "user",   "content": last_user_msg},
        *prompt2_history[-1:]
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
    )

    content = response.choices[0].message.content
    prompt2_history.append({"role": "assistant", "content": content})
    print("\n[Prompt 2 Reply]:", content)
    return content

# ───────────────────────  SUMMARY PRINTER  ─────────────────────
def print_full_summary(user_input: str,
                       reasoning_output: str,
                       tool_calls: list,
                       reflection_output: str) -> None:
    print("\n[User]:", user_input)
    print("\n[Prompt 1 Reasoning]:", reasoning_output)
    if tool_calls:
        print("\n[Tool Calls]:")
        for call in tool_calls:
            print(f"- {call['tool']} with args: {json.dumps(call['args'])}")
            print(f"  Result: {json.dumps(call['result'])}")
    print("\n[Prompt 2 Reply]:", reflection_output)

# ─────────────────────────  MAIN LOOP  ─────────────────────────
def main_loop() -> None:
    while True:
        user_input = input("\n[User]: ")
        if user_input.lower().strip() in {"exit", "quit"}:
            break

        reasoning_output  = run_prompt1(user_input)
        consistency_output = run_prompt1_5()
        reflection_output = run_prompt2(reasoning_output + "\n\n" + consistency_output, user_input)

        print_full_summary(user_input,
                           reasoning_output + "\n\n" + consistency_output,
                           tool_call_log,
                           reflection_output)


# ────────────────────────────  RUN  ────────────────────────────
if __name__ == "__main__":
    main_loop()
