# leads

## Overview

Public lead-capture form used by `client/src/pages/Programare.tsx`, plus a 3-step progress indicator that is also used by `client/src/pages/Apel.tsx`. When the form is submitted successfully, the server creates the lead and returns a link to the AI interview call.

## Interface

- `LeadForm` (default, no props) - react-hook-form + zod form with fields `parentName, parentPhone, childName, childAge, childPosition, consent`. After success it shows a card with the `callLink` CTA [LeadForm.tsx:LeadForm]
- `StepIndicator` (default) - props `{ current: Step }` [StepIndicator.tsx:StepIndicator]
- `Step` (exported type) = `1 | 2 | 3` [StepIndicator.tsx:Step]
- Expected success response: `{ ok: true; leadId; trainerId; callLink; whatsapp: { sent; reason; messageId } }` [LeadForm.tsx:SubmitResult]

## Invariants

- `parentName` and `childName` are trimmed and must be 2-120 chars [LeadForm.tsx:Schema]
- `parentPhone` is trimmed, then must be 7-32 chars and match `^[+\d\s()-]+$` [LeadForm.tsx:Schema]
- `childAge` is required: an empty value is turned into `undefined` and fails with "Vârsta este obligatorie". It must be an integer from 4 to 18. `childPosition` is at most 60 chars. `consent` must be `true` [LeadForm.tsx:Schema]
- A submit succeeds only when `res.ok` is true and the JSON has `ok`. Otherwise the form throws using `detail` or the fallback message [LeadForm.tsx:onSubmit]
- `TRAINER_NAME` maps the slugs `t-sopi`, `t-kelemen` and `t-dan` to display names [LeadForm.tsx:TRAINER_NAME]

## Side Effects

- HTTP POST `/api/lead/create` (JSON body = form values plus `source: 'web'`) [LeadForm.tsx:onSubmit]
- Resets the form after a successful submit

## Verification

- Run: `pnpm test` (no test targets this directory directly)
- Type-check: `pnpm check:app`
