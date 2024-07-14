export class StackLang {
  constructor(private readonly program: string) {}
  private readonly vm = new Vm();

  run(): void {
    for (const line of this.program.split("\n")) {
      for (const word of line.split(" ")) {
        this.vm.parse(word);
      }
    }
  }
}

class Vm {
  private stack: Array<Value> = [];
  private vars: Array<Map<string, Value>> = [
    new Map([
      [
        "+",
        {
          kind: "Native",
          fn: this.add.bind(this),
        },
      ],
      [
        "-",
        {
          kind: "Native",
          fn: this.sub.bind(this),
        },
      ],
      [
        "*",
        {
          kind: "Native",
          fn: this.mul.bind(this),
        },
      ],
      [
        "/",
        {
          kind: "Native",
          fn: this.div.bind(this),
        },
      ],
      [
        "<",
        {
          kind: "Native",
          fn: this.lt.bind(this),
        },
      ],
      [
        "if",
        {
          kind: "Native",
          fn: this.opIf.bind(this),
        },
      ],
      [
        "def",
        {
          kind: "Native",
          fn: this.opDef.bind(this),
        },
      ],
      [
        "puts",
        {
          kind: "Native",
          fn: this.puts.bind(this),
        },
      ],
    ]),
  ];
  private blocks: Array<Array<Value>> = [];

  public parse(word: string): void {
    if (word === "") return;

    if (word === "{") {
      this.blocks.push([]);
    } else if (word === "}") {
      const values = this.blocks.pop();
      if (values == null) throw new Error(`Block stack underflow`);
      this.eval({ kind: "Block", values });
    } else {
      const num = Number.parseFloat(word);
      if (!Number.isNaN(num)) {
        this.eval({ kind: "Num", num });
      } else if (word.startsWith("/")) {
        this.eval({ kind: "Symbol", sym: word.slice(1) });
      } else {
        this.eval({ kind: "Operator", op: word });
      }
    }
  }

  private eval(code: Value): void {
    // ブロック中のコードはBlockの内容を後でまとめてevalするためにblocksに積んでおく
    if (this.blocks.length !== 0) {
      this.blocks.at(-1)!.push(code);
      return;
    }
    // stackを操作するのはOperatorのみなので、それ以外はstackに積むだけ
    if (code.kind !== "Operator") {
      this.stack.push(code);
      return;
    }

    const variableValue = this.findVar(code.op);
    if (variableValue == null)
      throw new Error(`${code.op} is not a defined operation`);

    if (variableValue.kind === "Block") {
      this.vars.push(new Map());
      for (const v of variableValue.values) {
        this.eval(v);
      }
      this.vars.pop();
    } else if (variableValue.kind === "Native") {
      variableValue.fn();
    } else {
      this.stack.push(variableValue);
    }
  }

  private findVar(word: string): Value | null {
    return (
      this.vars.toReversed().flatMap((varMap) => {
        const v = varMap.get(word);
        return v ?? [];
      })[0] ?? null
    );
  }

  private add() {
    const right = this.stack.pop();
    const left = this.stack.pop();
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num +, (${left} ${right} +)`);
    this.stack.push({ kind: "Num", num: left.num + right.num });
  }

  private sub() {
    const right = this.stack.pop();
    const left = this.stack.pop();
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num -, (${left} ${right} -)`);
    this.stack.push({ kind: "Num", num: left.num - right.num });
  }

  private mul() {
    const right = this.stack.pop();
    const left = this.stack.pop();
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num *, (${left} ${right} *)`);
    this.stack.push({ kind: "Num", num: left.num * right.num });
  }

  private div() {
    const right = this.stack.pop();
    const left = this.stack.pop();
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num /, (${left} ${right} /)`);
    this.stack.push({ kind: "Num", num: left.num / right.num });
  }

  private lt() {
    const right = this.stack.pop();
    const left = this.stack.pop();
    if (
      right == null ||
      left == null ||
      right.kind !== "Num" ||
      left.kind !== "Num"
    )
      throw new Error(`Expect Num Num /, (${left} ${right} /)`);
    this.stack.push({ kind: "Num", num: left.num < right.num ? 1 : 0 });
  }

  private opIf() {
    const falseBranch = this.stack.pop();
    if (falseBranch == null || falseBranch.kind !== "Block")
      throw new Error(`Expect block (${falseBranch})`);
    const trueBranch = this.stack.pop();
    if (trueBranch == null || trueBranch.kind !== "Block")
      throw new Error(`Expect block (${trueBranch})`);
    const cond = this.stack.pop();
    if (cond == null || cond.kind !== "Block")
      throw new Error(`Expect block (${cond})`);

    for (const v of cond.values) {
      this.eval(v);
    }
    const condResult = this.stack.pop();
    if (condResult == null || condResult.kind !== "Num")
      throw new Error(`Expect num (${condResult})`);

    if (condResult.num !== 0) {
      for (const v of trueBranch.values) {
        this.eval(v);
      }
    } else {
      for (const v of falseBranch.values) {
        this.eval(v);
      }
    }
  }

  private opDef() {
    const value = this.stack.pop();
    if (value == null) throw new Error(`Expect value but got undefined`);
    this.eval(value);
    const evalResult = this.stack.pop();
    if (evalResult == null) throw new Error(`Expect value but got undefined`);

    const symbol = this.stack.pop();
    if (symbol == null || symbol.kind !== "Symbol")
      throw new Error(`Expect symbol (${symbol})`);

    this.vars.at(-1)?.set(symbol.sym, evalResult);
  }

  private puts() {
    const value = this.stack.pop();
    if (value == null) throw new Error(`stack under-run`);
    console.log(value);
  }
}

type Value =
  | { kind: "Num"; num: number }
  | { kind: "Operator"; op: string }
  | { kind: "Symbol"; sym: string }
  | { kind: "Block"; values: readonly Value[] }
  | { kind: "Native"; fn: () => void };
