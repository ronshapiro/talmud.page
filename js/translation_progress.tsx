import * as React from "react";
import {render} from "react-dom";
import {FontCache} from "./FontCache";
import {TranslationProgressDashboard} from "./TranslationProgressDashboard";
import {TranslationProgressData} from "../precomputed/translation_progress_data";

new FontCache().loadAll();

function initializeDashboard() {
  const rootElement = document.getElementById("main-contents");
  if (!rootElement) {
    setTimeout(initializeDashboard, 10);
    return;
  }

  let initialProgressData: TranslationProgressData | undefined;
  const embeddedScript = document.getElementById("translation-progress-data");
  if (embeddedScript && embeddedScript.textContent && embeddedScript.textContent.trim()) {
    try {
      initialProgressData = JSON.parse(embeddedScript.textContent) as TranslationProgressData;
    } catch {
      // Ignore parse error
    }
  }

  render(<TranslationProgressDashboard initialData={initialProgressData} />, rootElement);
}

initializeDashboard();
