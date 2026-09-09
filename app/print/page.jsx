"use client";

import { useEffect, useState } from "react";
import { load, loadProfile } from "../../lib/store";
import { resumeBodyHTML, PRINT_CSS } from "../../lib/resume";

export default function PrintPage() {
  const [html, setHtml] = useState("");

  useEffect(() => {
    const p = load("sb.printProfile", null) || loadProfile();
    setHtml(resumeBodyHTML(p));
    const t = setTimeout(() => {
      try { window.print(); } catch (e) {}
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS + `
        body { background: #fff; }
        .nav { display: none !important; }
        .shell { padding-bottom: 0 !important; max-width: none !important; }
        .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd;
                   padding: 10px 14px; display: flex; gap: 8px; align-items: center;
                   font-family: system-ui, sans-serif; font-size: 13px; }
        .toolbar button { padding: 7px 12px; border: 1px solid #2340d8; background: #2340d8;
                          color: #fff; border-radius: 5px; font-size: 13px; }
        @media print { .toolbar { display: none; } }
      ` }} />
      <div className="toolbar noprint">
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <span style={{ color: "#666" }}>Choose &ldquo;Save as PDF&rdquo; as the destination.</span>
      </div>
      <div className="sheet" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
