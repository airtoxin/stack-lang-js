import { useCallback, useState } from 'react'
import './App.css'
import { StackLang } from "./StackLang.ts";

function App() {
  const [input, setInput] = useState<string>("");
  const handleClickRun = useCallback(() => {
    new StackLang(input).run();
  }, [input]);

  return (
    <div>
      <textarea name="program" value={input} rows={10} onChange={event => setInput(event.target.value)}></textarea>
      <button onClick={handleClickRun}>Run</button>
    </div>
  )
}

export default App
