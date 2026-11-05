"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Template = { subject: string; heading: string; body: string };
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Edits the copy for each transactional email. Every template is submitted
 * together; switching tabs only changes which fields are visible.
 */
export function EmailTemplatesForm({
  templates,
  defaults,
  meta,
  saveAction,
  testAction,
}: {
  templates: Record<string, Template>;
  defaults: Record<string, Template>;
  meta: Record<string, { label: string; placeholders: string[] }>;
  saveAction: Action;
  testAction: Action;
}) {
  const keys = Object.keys(meta);
  const [active, setActive] = useState(keys[0]);
  const [values, setValues] = useState(templates);
  const [saveState, save, saving] = useActionState<ActionState, FormData>(saveAction, {});
  const [testState, test, testing] = useActionState<ActionState, FormData>(testAction, {});

  const update = (key: string, field: keyof Template, value: string) => setValues((v) => ({ ...v, [key]: { ...v[key], [field]: value } }));

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-xl font-bold">Email copy</h2>
      <p className="mb-5 text-sm text-muted">Edit the words; the layout, tickets and buttons stay on-brand automatically. Leave a field blank to use the default.</p>

      <div role="tablist" aria-label="Email templates" className="mb-5 flex flex-wrap gap-2">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            onClick={() => setActive(key)}
            className={cn("rounded-full border px-4 py-2 text-sm font-medium transition", active === key ? "border-brand bg-brand text-ink" : "border-line text-muted hover:text-white")}
          >
            {meta[key].label}
          </button>
        ))}
      </div>

      <form action={save} className="space-y-4">
        {keys.map((key) => (
          <div key={key} role="tabpanel" hidden={active !== key} className="space-y-4">
            <div>
              <Label htmlFor={`${key}-subject`}>Subject</Label>
              <Input id={`${key}-subject`} name={`${key}.subject`} value={values[key].subject} placeholder={defaults[key].subject} onChange={(e) => update(key, "subject", e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${key}-heading`}>Heading</Label>
              <Input id={`${key}-heading`} name={`${key}.heading`} value={values[key].heading} placeholder={defaults[key].heading} onChange={(e) => update(key, "heading", e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${key}-body`}>Message</Label>
              <Textarea id={`${key}-body`} name={`${key}.body`} rows={5} value={values[key].body} placeholder={defaults[key].body} onChange={(e) => update(key, "body", e.target.value)} />
              <p className="mt-1 text-xs text-muted">
                Blank line = new paragraph.
                {meta[key].placeholders.length > 0 && (
                  <>
                    {" "}
                    Placeholders:{" "}
                    {meta[key].placeholders.map((p) => (
                      <code key={p} className="mx-0.5 rounded bg-white/10 px-1">{`{{${p}}}`}</code>
                    ))}
                  </>
                )}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setValues((v) => ({ ...v, [key]: { subject: "", heading: "", body: "" } }))}>
              Reset to default
            </Button>
          </div>
        ))}
        {saveState.error && (
          <p role="alert" className="text-sm text-danger">
            {saveState.error}
          </p>
        )}
        {saveState.ok && (
          <p role="status" className="text-sm text-success">
            {saveState.ok}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save email copy"}
        </Button>
      </form>

      <form action={test} className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <input type="hidden" name="template" value={active} />
        <Button type="submit" variant="outline" size="sm" disabled={testing}>
          {testing ? "Sending…" : `Send me a test of "${meta[active].label}"`}
        </Button>
        <span className="text-xs text-muted">Uses the saved copy. Save first.</span>
        {testState.ok && <span role="status" className="text-sm text-success">{testState.ok}</span>}
        {testState.error && <span role="alert" className="text-sm text-danger">{testState.error}</span>}
      </form>
    </Card>
  );
}
