const PYODIDE_VERSION = "314.0.6";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Impossible de charger Python.")));
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Impossible de charger Python."));
    document.head.appendChild(script);
  });
}

export function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = loadScript(`${PYODIDE_CDN}pyodide.js`).then(() => {
      if (!window.loadPyodide) throw new Error("Python indisponible.");
      return window.loadPyodide({ indexURL: PYODIDE_CDN });
    });
  }
  return pyodidePromise;
}

export interface PythonRunResult {
  output: string;
  error: string | null;
}

export async function runPython(code: string): Promise<PythonRunResult> {
  const pyodide = await getPyodide();
  const lines: string[] = [];
  pyodide.setStdout({ batched: (s: string) => lines.push(s) });
  pyodide.setStderr({ batched: (s: string) => lines.push(s) });
  try {
    await pyodide.runPythonAsync(code);
    return { output: lines.join("\n"), error: null };
  } catch (err) {
    return {
      output: lines.join("\n"),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
