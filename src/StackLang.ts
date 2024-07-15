export class StackLang {
  constructor(private readonly program: string) {}
  private readonly vm = new Vm();

  *run(): Generator<VmEvent> {
    yield this.vm.stateEvent();
    for (const line of this.program.split("\n")) {
      for (const word of line.split(" ")) {
        yield* this.vm.parse(word);
      }
    }
  }
}

export type VmEvent =
  | { kind: "state"; state: VmState }
  | { kind: "puts"; value: Value }
  | { kind: "stackPop"; state: VmState; value: Value };

export type VmState = {
  stack: Array<Value>;
  vars: Array<Record<string, Value>>;
  blocks: Array<Array<Value>>;
};

class Vm {
  private state: VmState = {
    stack: [],
    vars: [
      {
        "+": {
          kind: "Native",
          fn: this.add.bind(this),
        },
        "-": {
          kind: "Native",
          fn: this.sub.bind(this),
        },
        "*": {
          kind: "Native",
          fn: this.mul.bind(this),
        },
        "/": {
          kind: "Native",
          fn: this.div.bind(this),
        },
        "<": {
          kind: "Native",
          fn: this.lt.bind(this),
        },
        if: {
          kind: "Native",
          fn: this.opIf.bind(this),
        },
        def: {
          kind: "Native",
          fn: this.opDef.bind(this),
        },
        exch: {
          kind: "Native",
          fn: this.opExch.bind(this),
        },
        puts: {
          kind: "Native",
          fn: this.puts.bind(this),
        },
      },
    ],
    blocks: [],
  };

  public stateEvent(): VmEvent {
    return { kind: "state", state: this.state };
  }

  private stackPopEvent(value: Value | undefined): VmEvent {
    if (value == null) throw new Error(`Stack pop error`);
    return { kind: "stackPop", state: this.state, value };
  }

  public *parse(word: string): Generator<VmEvent> {
    if (word === "") return yield this.stateEvent();

    if (word === "{") {
      this.state.blocks.push([]);
      yield this.stateEvent();
    } else if (word === "}") {
      const values = this.state.blocks.pop();
      yield this.stateEvent();
      if (values == null) throw new Error(`Block stack underflow`);
      yield* this.eval({ kind: "Block", values });
    } else {
      const num = Number.parseFloat(word);
      if (!Number.isNaN(num)) {
        yield* this.eval({ kind: "Num", num });
      } else if (word.startsWith("/")) {
        yield* this.eval({ kind: "Symbol", sym: word.slice(1) });
      } else {
        yield* this.eval({ kind: "Operator", op: word });
      }
    }
  }

  private *eval(code: Value): Generator<VmEvent> {
    // ブロック中のコードはBlockの内容を後でまとめてevalするためにblocksに積んでおく
    if (this.state.blocks.length !== 0) {
      this.state.blocks.at(-1)!.push(code);
      return yield this.stateEvent();
    }
    // stackを操作するのはOperatorのみなので、それ以外はstackに積むだけ
    if (code.kind !== "Operator") {
      this.state.stack.push(code);
      return yield this.stateEvent();
    }

    const variableValue = this.findVar(code.op);
    if (variableValue == null)
      throw new Error(`${code.op} is not a defined operation`);

    if (variableValue.kind === "Block") {
      this.state.vars.push({});
      yield this.stateEvent();
      for (const v of variableValue.values) {
        yield* this.eval(v);
      }
      this.state.vars.pop();
      yield this.stateEvent();
    } else if (variableValue.kind === "Native") {
      yield* variableValue.fn();
    } else {
      this.state.stack.push(variableValue);
      yield this.stateEvent();
    }
  }

  private findVar(word: string): Value | null {
    return (
      this.state.vars.toReversed().flatMap((varMap) => {
        const v = varMap[word];
        return v ?? [];
      })[0] ?? null
    );
  }

  private *add(): Generator<VmEvent> {
    const right = this.state.stack.pop();
    yield this.stackPopEvent(right);
    const left = this.state.stack.pop();
    yield this.stackPopEvent(left);
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num +, (${left} ${right} +)`);
    this.state.stack.push({ kind: "Num", num: left.num + right.num });
    yield this.stateEvent();
  }

  private *sub(): Generator<VmEvent> {
    const right = this.state.stack.pop();
    yield this.stackPopEvent(right);
    const left = this.state.stack.pop();
    yield this.stackPopEvent(left);
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num -, (${left} ${right} -)`);
    this.state.stack.push({ kind: "Num", num: left.num - right.num });
    yield this.stateEvent();
  }

  private *mul(): Generator<VmEvent> {
    const right = this.state.stack.pop();
    yield this.stackPopEvent(right);
    const left = this.state.stack.pop();
    yield this.stackPopEvent(left);
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num *, (${left} ${right} *)`);
    this.state.stack.push({ kind: "Num", num: left.num * right.num });
    yield this.stateEvent();
  }

  private *div(): Generator<VmEvent> {
    const right = this.state.stack.pop();
    yield this.stackPopEvent(right);
    const left = this.state.stack.pop();
    yield this.stackPopEvent(left);
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num /, (${left} ${right} /)`);
    this.state.stack.push({ kind: "Num", num: left.num / right.num });
    yield this.stateEvent();
  }

  private *lt(): Generator<VmEvent> {
    const right = this.state.stack.pop();
    yield this.stackPopEvent(right);
    const left = this.state.stack.pop();
    yield this.stackPopEvent(left);
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num /, (${left} ${right} /)`);
    this.state.stack.push({ kind: "Num", num: left.num < right.num ? 1 : 0 });
    yield this.stateEvent();
  }

  private *opIf(): Generator<VmEvent> {
    const falseBranch = this.state.stack.pop();
    yield this.stackPopEvent(falseBranch);
    if (falseBranch == null || falseBranch.kind !== "Block")
      throw new Error(`Expect block (${falseBranch})`);
    const trueBranch = this.state.stack.pop();
    yield this.stackPopEvent(trueBranch);
    if (trueBranch == null || trueBranch.kind !== "Block")
      throw new Error(`Expect block (${trueBranch})`);
    const cond = this.state.stack.pop();
    yield this.stackPopEvent(cond);
    if (cond == null || cond.kind !== "Block")
      throw new Error(`Expect block (${cond})`);

    for (const v of cond.values) {
      yield* this.eval(v);
    }
    const condResult = this.state.stack.pop();
    yield this.stackPopEvent(condResult);
    if (condResult == null || condResult.kind !== "Num")
      throw new Error(`Expect num (${condResult})`);

    if (condResult.num !== 0) {
      for (const v of trueBranch.values) {
        yield* this.eval(v);
      }
    } else {
      for (const v of falseBranch.values) {
        yield* this.eval(v);
      }
    }
  }

  private *opDef(): Generator<VmEvent> {
    const value = this.state.stack.pop();
    yield this.stackPopEvent(value);
    if (value == null) throw new Error(`Expect value but got undefined`);
    yield* this.eval(value);
    const evalResult = this.state.stack.pop();
    yield this.stackPopEvent(evalResult);
    if (evalResult == null) throw new Error(`Expect value but got undefined`);

    const symbol = this.state.stack.pop();
    yield this.stackPopEvent(symbol);
    if (symbol == null || symbol.kind !== "Symbol")
      throw new Error(`Expect symbol (${symbol})`);

    this.state.vars.at(-1)![symbol.sym] ??= evalResult;
    yield this.stateEvent();
  }

  private *opExch(): Generator<VmEvent> {
    const last = this.state.stack.pop();
    yield this.stackPopEvent(last);
    if (last == null) throw new Error(`Expect value but got undefined`);

    const second = this.state.stack.pop();
    yield this.stackPopEvent(second);
    if (second == null) throw new Error(`Expect value but got undefined`);
    yield* this.eval(second);

    this.state.stack.push(last);
    yield this.stateEvent();
    this.state.stack.push(second);
    yield this.stateEvent();
  }

  private *puts(): Generator<VmEvent> {
    const value = this.state.stack.pop();
    yield this.stackPopEvent(value);
    if (value == null) throw new Error(`stack under-run`);
    yield { kind: "puts", value };
  }
}

export type Value =
  | { kind: "Num"; num: number }
  | { kind: "Operator"; op: string }
  | { kind: "Symbol"; sym: string }
  | { kind: "Block"; values: readonly Value[] }
  | { kind: "Native"; fn: () => Generator<VmEvent> };
