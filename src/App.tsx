import {
  FunctionComponent,
  PropsWithChildren,
  useCallback,
  useState,
} from "react";
import { StackLang, Value, VmState } from "./StackLang.ts";

const initialInput = `\
/x 10 def
/y { 20 } def
/xy { x y + } def

xy x *
puts
`;

function App() {
  const reset = useCallback(() => {
    setOutputs([]);
    setVmState({ stack: [], vars: [], blocks: [] });
  }, []);
  const [input, setInput] = useState<string>(initialInput);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [vmState, setVmState] = useState<VmState>({
    stack: [],
    vars: [],
    blocks: [],
  });
  const handleClickRun = useCallback(async () => {
    for (const vmEvent of new StackLang(input).run()) {
      if (vmEvent.kind === "state") {
        setVmState({ ...vmEvent.state });
      } else if (vmEvent.kind === "stackPop") {
        setVmState(vmEvent.state);
        setOutputs((os) =>
          [`pop ${serializeValue(vmEvent.value)}`].concat(os).slice(0, 5),
        );
      } else if (vmEvent.kind === "puts") {
        setOutputs((os) =>
          [`puts ${serializeValue(vmEvent.value)}`].concat(os).slice(0, 5),
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }, [input]);

  return (
    <main className="h-dvh flex gap-2">
      <div className="w-1/2 flex flex-col-reverse">
        <textarea
          className="h-full border rounded font-mono p-1 resize-none"
          name="program"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button className="border rounded hover:bg-amber-50" onClick={reset}>
          Reset
        </button>
        <button
          className="border rounded hover:bg-amber-50"
          onClick={handleClickRun}
        >
          Run
        </button>
      </div>
      <div className="w-1/2 flex flex-col gap-2 [&>*]:m-1 [&>*]:h-full [&>*]:overflow-scroll">
        <VmStateSection label="output">
          {outputs.map((output) => (
            <p>{output}</p>
          ))}
        </VmStateSection>
        <VmStateSection label="stack">
          {vmState.stack.toReversed().map((v) => (
            <div>{serializeValue(v)}</div>
          ))}
        </VmStateSection>
        <VmStateSection label="vars">
          <ol>
            {vmState.vars.toReversed().map((variableScope) => (
              <li className="border p-2">
                <ul className="list-inside list-disc">
                  {Object.entries(variableScope).map(([k, v]) => (
                    <li key={k}>
                      {k} = {serializeValue(v)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </VmStateSection>
        <VmStateSection label="blocks">
          <ol>
            {vmState.blocks.toReversed().map((blockCode) => (
              <li className="border p-2">
                <ul className="list-inside list-disc">
                  {blockCode.toReversed().map((v) => (
                    <li>{serializeValue(v)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </VmStateSection>
      </div>
    </main>
  );
}

const serializeValue = (value: Value): string => {
  switch (value.kind) {
    case "Num":
      return "" + value.num;
    case "Native":
      return `<Native>`;
    case "Symbol":
      return value.sym;
    case "Operator":
      return value.op;
    case "Block":
      return `{ ${value.values.map((v) => serializeValue(v)).join(" ")} }`;
  }
};

const VmStateSection: FunctionComponent<
  PropsWithChildren<{ label: string }>
> = ({ label, children }) => (
  <section className="p-2 bg-blue-950 text-amber-50">
    <label className="inline-block px-1 rounded-br font-bold mb-2 bg-white text-blue-950 -translate-x-2 -translate-y-2">
      {label}
    </label>
    {children}
  </section>
);

export default App;
