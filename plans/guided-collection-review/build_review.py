"""Build the local, offline design gallery and editable SVG overview charts.

Only writes artifacts beside this script. Does not load application code or data.
"""

from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent


def chart(proposed=False):
    height = 1600 if proposed else 1700
    title = "Proposed guided collection" if proposed else "Current guided collection"
    parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="{height}" viewBox="0 0 1200 {height}" role="img" aria-labelledby="title desc">
<title id="title">{title}</title><desc id="desc">Shared client and payment preparation splits into instant report processing or lab collection. Dashed arrows show recovery and exceptions. The full decision table is in README.md.</desc>
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#64748b"/></marker><marker id="redarrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#b45309"/></marker></defs>
<rect width="1200" height="{height}" fill="#fff"/>
<style>text{{font-family:Arial,sans-serif;fill:#13233a}} .title{{font-size:28px;font-weight:700}} .label{{font-size:16px;fill:#53647a}} .head{{font-size:19px;font-weight:700}} .body{{font-size:16px}} .connector{{fill:none;stroke:#64748b;stroke-width:2;marker-end:url(#arrow)}} .recovery{{stroke:#b45309;stroke-dasharray:7 5;marker-end:url(#redarrow)}}</style>
<text x="50" y="45" class="title">{title}</text>''']

    def text(x, y, value, kind="body", anchor="middle"):
        parts.append(f'<text x="{x}" y="{y}" class="{kind}" text-anchor="{anchor}">{html.escape(value)}</text>')

    def box(x, y, w, h, heading, lines=(), fill="#f8fafc", stroke="#cbd5e1"):
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}"/>')
        start = y + 28 if lines else y + h / 2 + 7
        text(x + w / 2, start, heading, "head")
        for index, line in enumerate(lines):
            text(x + w / 2, start + 25 * (index + 1), line)

    def edge(path, recovery=False):
        parts.append(f'<path class="connector{" recovery" if recovery else ""}" d="{path}"/>')

    text(50, 76, "Overview chart • full branches, guards and evidence are in the accompanying flow map", "label", "start")
    box(405, 110, 390, 65, "Today's schedule / walk-in")
    edge("M600 175 V210")
    box(405, 210, 390, 90, "Review client & appointment", ["Client, identity, headshot, test, referral"])
    box(35, 212, 320, 115, "Conditional detours", ["Link or register client", "Select test • confirm name mismatch", "Capture photo or confirm continuation"])
    edge("M405 248 H355", True)
    edge("M355 292 H380 V275 H405", True)
    edge("M600 300 V345")

    if proposed:
        box(405, 345, 390, 140, "Payment responsibility", ["Bill referral: ON → referral owes this test", "OFF → client pays; exclude from invoice", "Prepaid / cash / card / explicit credit", "Older CLIENT debt remains visible"], "#eff6ff", "#8caed3")
        box(835, 350, 325, 130, "Separate backend change", ["Persist booking → test payer", "Invoice / allocation / tracker agree", "Do not change referral profile"], "#fff7ed", "#e9bc80")
        edge("M795 415 H835", True)
        edge("M600 485 V530 H305 V575")
        edge("M600 530 H900 V575")
        text(325, 560, "17-PANEL INSTANT", "label", "start")
        text(920, 560, "LAB TESTS", "label", "start")
        box(110, 575, 390, 140, "Generate & upload report", ["Open ToxAccess in another tab", "Generate / save PDF • return here", "Waiting for PDF until attached", "No tab-close or webhook inference"], "#eff6ff", "#8caed3")
        box(715, 575, 370, 115, "Prepare lab specimen", ["ToxAccess reference and test code", "Manual fallback retained", "Lab results come later"])
        box(35, 757, 220, 85, "No PDF? Stay here", ["Reopen ToxAccess"] , "#fff7ed", "#e9bc80")
        edge("M110 650 H75 V755", True)
        edge("M145 757 V735 H200 V715", True)
        box(510, 760, 195, 100, "Back to Payment", ["Keep same booking", "Keep recorded payment"], "#fff7ed", "#e9bc80")
        edge("M500 680 H560 V760", True)
        edge("M715 650 H710 V805 H705", True)
        edge("M305 715 V870")
        box(110, 870, 390, 95, "Review extracted report", ["Warnings visible • client match", "Mismatch acknowledgement retained"])
        edge("M305 965 V1005")
        box(110, 1005, 390, 75, "Verify medications", ["Occasional edits remain available"])
        edge("M305 1080 V1120")
        box(110, 1120, 390, 115, "Verify instant test", ["Date • substances • dilute • optional BAC", "If required: accept / confirm / decide later", "Requested substances remain required"])
        edge("M305 1235 V1280")
        box(110, 1280, 390, 105, "Review & create screened test", ["Client / referral result recipients", "Attach PDF • existing creation action"], "#f0fdf4", "#9bc6ad")
        edge("M900 690 V870")
        box(715, 870, 370, 95, "Verify medications", ["Same medication checkpoint", "No PDF or result required"])
        edge("M900 965 V1005")
        box(715, 1005, 370, 110, "Confirm collection", ["Test • collection date • optional BAC", "Type changes require payment review", "Collection remains awaiting lab results"])
        edge("M900 1115 V1280")
        box(715, 1280, 370, 105, "Review & create lab collection", ["Referral collection notification only", "Existing creation action"], "#f0fdf4", "#9bc6ad")
        edge("M305 1385 V1435 H600 V1470")
        edge("M900 1385 V1435 H600")
        box(405, 1470, 390, 85, "Created record + delivery outcome", ["Return to schedule • no duplicate create"] , "#f0fdf4", "#9bc6ad")
        text(1125, 1475, "One fewer instant screen", "label", "end")
    else:
        box(405, 345, 390, 135, "Payment review", ["Prepaid / cash / Terminal / account credit", "Billable referral blocks client payment", "Zero payment with debt → acknowledge", "Writes booking payment state"], "#eff6ff", "#8caed3")
        box(835, 352, 325, 120, "Existing financial rules", ["Older eligible debt first", "Then today's test", "Excess payment → account credit"])
        edge("M795 410 H835")
        edge("M600 480 V525")
        box(405, 525, 390, 115, "Collect in ToxAccess", ["Donor/default-test setup checked", "External tab; manual fallback possible", "Report generation is not observed"])
        edge("M600 640 V700 H305 V745")
        edge("M600 700 H900 V745")
        text(325, 725, "17-PANEL INSTANT", "label", "start")
        text(920, 725, "LAB TESTS", "label", "start")
        box(110, 745, 390, 80, "Upload PDF", ["Report must already exist"])
        edge("M305 825 V870")
        box(110, 870, 390, 110, "Extract and review", ["Parser errors / warnings / unsupported test", "Report/client name check", "Mismatch needs explicit confirmation"])
        edge("M305 980 V1025")
        box(110, 1025, 390, 80, "Verify medications", ["Client step skipped after guided hydration"])
        edge("M305 1105 V1150")
        box(110, 1150, 390, 120, "Verify instant data", ["Date • substances • dilute • optional BAC", "Unexpected positives needing decision:", "accept / request confirmation / pending"])
        edge("M305 1270 V1315")
        box(110, 1315, 390, 110, "Review result emails → create", ["Client and referral recipient choices", "Creates screened test + PDF", "Medication and payment snapshots"], "#f0fdf4", "#9bc6ad")
        box(715, 745, 370, 80, "Verify medications", ["Guided route starts here"])
        edge("M900 825 V1025")
        box(715, 1025, 370, 110, "Confirm lab collection", ["Test type • collection date", "Optional breathalyzer/BAC", "No lab screening result yet"])
        edge("M900 1135 V1315")
        box(715, 1315, 370, 110, "Review notification → create", ["Referral collection notification", "Creates collected test; awaiting results", "No result PDF attachment"], "#f0fdf4", "#9bc6ad")
        edge("M110 785 H65 V1480", True)
        box(35, 1480, 330, 105, "Back exits to schedule", ["Selected booking is cleared", "Setup must be revisited"], "#fff7ed", "#e9bc80")
        edge("M1085 785 H1135 V1480", True)
        box(815, 1480, 330, 105, "Back exits to schedule", ["Selected booking is cleared", "Setup must be revisited"], "#fff7ed", "#e9bc80")
        edge("M305 1425 V1450 H600 V1600")
        edge("M900 1425 V1450 H600")
        box(405, 1600, 390, 70, "Mark booking collected", ["Link test • return to schedule"], "#f0fdf4", "#9bc6ad")
    parts.append("</svg>")
    return "\n".join(parts)


screens = [
    ("01-schedule", "Today's collections", "Shared", "Schedule, walk-ins and completed appointments remain available. The compact table is a concept; keep the existing touch-friendly schedule cards in the first low-risk pass."),
    ("02-review-client", "Review client & appointment", "Shared", "Keep client, headshot, test and referral edits. Use one consistent title and a compact context summary on later screens."),
    ("17-link-client-v2", "Choose or register client", "Shared", "Conditional detour only. Existing registration retains personal information, account, screening/referral, recipients and terms before returning to this appointment."),
    ("03-payment-owed-v2", "Payment — client owes", "Payment", "The example has no payment entered yet. The action accurately says Continue with balance owing and still requires the existing confirmation. Cash/card, credit, receipts and older-balance allocation stay intact."),
    ("04-payment-prepaid", "Payment — prepaid", "Payment", "No payment controls by default when all client balances are settled. Optional Add account credit is collapsed. If older client debt exists, show it visibly rather than implying the account owes nothing."),
    ("05-payment-referral-v2", "Payment — bill referral ON", "Payment", "Proposed per-test switch. The referral owes this test; it is not marked paid. Payer persistence, invoice selection, allocation and tracker changes must land together."),
    ("06-payment-client-override", "Payment — bill referral OFF", "Payment", "The client pays this test; the referral profile remains invoice-enabled. Even an unpaid/partial client-pay exception must stay excluded from referral invoices."),
    ("07-generate-upload-report", "Generate & upload report", "Instant", "Recommended combined instant preparation/upload screen. ToxAccess opens in another tab. Returning focus leaves Waiting for PDF; only attaching a file enables report review. No report-generation webhook is assumed."),
    ("08-prepare-lab", "Prepare lab collection", "Lab", "Lab reference and code, donor status and manual fallback. Lab preparation remains separate; no instant PDF or result questions appear."),
    ("10-review-extraction", "Review extracted report", "Instant", "Use normal-size values and preserve name matching, unsupported-test rejection and visible parser warnings. Only optional raw diagnostic details collapse. This negative example is independent of the later positive-result example."),
    ("11-medications", "Verify medications", "Shared", "Keep this checkpoint for both branches. Medication edits/discontinuation and snapshots influence classification. The Back label depends on the selected branch."),
    ("12-instant-details", "Verify instant test", "Instant", "Unexpected-positive example: preserve accept, request confirmation and decide-later options. Required confirmation substances remain visible; date, dilute and BAC edits remain available."),
    ("13-lab-details", "Confirm lab collection", "Lab", "Preserve date and optional BAC. A guided test-type edit must reconcile the booking price, payment and ToxAccess reference before creation. No negative result is inferred."),
    ("14-instant-email-review", "Review instant result emails", "Instant", "Client/referral recipient choices and PDF attachment remain. Review details and selected recipients before the existing final creation action."),
    ("15-lab-notification-review", "Review collection notification", "Lab", "Referral collection notification only, with recipient editing and preview. Collection notification differs from result reporting and billing responsibility."),
    ("16-complete", "Created record — lab example", "Shared", "Show actual record and notification outcome. If creation succeeded but email delivery failed, acknowledge the saved record and offer recovery instead of repeating creation."),
    ("07-prepare-instant", "Alternative: separate instant preparation", "Alternative", "Lower-scope alternative retaining the current two screens. Make the generate-and-save-PDF task explicit and retain a direct return from upload to the same appointment."),
    ("09-upload-report", "Alternative: separate upload with recovery", "Alternative", "Pair with the separate preparation alternative. Back to report preparation retains the booking and recorded payment instead of resetting the collection."),
]
data = [{"id": identifier, "title": title, "group": group, "note": note, "src": f"images/{identifier}.png"} for identifier, title, group, note in screens]
if (ROOT / "simple-screens.json").exists():
    data = json.loads((ROOT / "simple-screens.json").read_text(encoding="utf-8"))
default_screen = "12-instant-details-simple" if any(s["id"] == "12-instant-details-simple" for s in data) else "07-generate-upload-report"

template = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Guided collection design review</title>
<style>
:root{color-scheme:light;--ink:#14243a;--blue:#20548a;--line:#dce3eb;--muted:#52657a;--paper:#f6f8fb}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,sans-serif}button,select{font:inherit}button,a,select{touch-action:manipulation}a{color:var(--blue)}button{cursor:pointer;border:1px solid var(--line);border-radius:7px;padding:9px 15px;background:white;color:var(--ink)}button[aria-selected=true],button.active{background:var(--blue);color:white;border-color:var(--blue)}button:disabled{opacity:.45;cursor:default}button:focus-visible,a:focus-visible,select:focus-visible{outline:3px solid #73a7db;outline-offset:3px}
header{max-width:1440px;margin:auto;padding:27px 32px 18px}h1{font-size:28px;line-height:1.2;margin:8px 0 12px}h2{font-size:22px;margin:0 0 12px}h3{font-size:18px;margin:16px 0 8px}.eyebrow{color:var(--blue);font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.intro{max-width:940px;margin:0;color:var(--muted)}.meta{font-size:13px;color:var(--muted);margin-top:10px}.nav{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}main{max-width:1440px;margin:auto;padding:0 32px 32px}.panel{background:white;border:1px solid var(--line);border-radius:9px;padding:22px}.toolbar{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.control{display:flex;flex-direction:column;gap:5px;flex:1;min-width:200px}label{font-size:13px;font-weight:600}select{border:1px solid var(--line);border-radius:6px;padding:10px;background:white;color:var(--ink);width:100%;min-height:42px}.browse{display:flex;gap:8px}.count{font-size:13px;color:var(--muted);white-space:nowrap}.viewer-head{display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin:22px 0 8px}.viewer-head h2{margin:0}.group{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.note{max-width:1040px;color:var(--muted);margin:0 0 18px}.screen-img{display:block;width:100%;height:auto;border:1px solid var(--line);border-radius:8px;background:#f8fafc}.links{display:flex;gap:20px;flex-wrap:wrap;margin-top:13px;font-size:13px}.recommend{border-left:3px solid var(--blue);padding:0 0 0 16px;margin:20px 0}.recommend p{margin:5px 0}.flow-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 18px}.flow{overflow-x:auto}.flow img{display:block;width:100%;min-width:860px;height:auto}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px;min-width:600px}th,td{border-bottom:1px solid var(--line);text-align:left;padding:12px;vertical-align:top}th{background:var(--paper);font-weight:600}.body-copy{max-width:1050px}.body-copy p{margin:12px 0}.body-copy li{margin:12px 0}.quiet{color:var(--muted)}.pill{display:inline-block;border-radius:4px;background:#edf4fc;color:var(--blue);padding:3px 8px;font-size:12px}footer{color:var(--muted);font-size:12px;margin-top:22px}[hidden]{display:none!important}
@media(max-width:700px){header{padding:22px 16px 16px}main{padding:0 16px 22px}.panel{padding:14px}h1{font-size:24px}.viewer-head{display:block}.control{min-width:100%;flex:auto}.browse{width:100%;align-items:center}.browse .count{margin-left:auto}.note{font-size:14px}.nav button{flex:1;min-width:120px}.flow{border-bottom:1px solid var(--line)}.viewer-head h2{font-size:20px}.links{gap:12px}}
@media print{header .nav,.toolbar,.links,.flow-tabs{display:none}.screen-img{break-inside:avoid}body{background:white}.panel{border:0}main,header{padding:12px}}
</style></head><body>
<header><div class="eyebrow">MI Drug Test · design review · October 3, 2026</div><h1>A clearer guided collection</h1><p class="intro">Simple step layouts, a small headshot header, one compact result strip, and optional edits collapsed. Prepare shows only the client and generate/upload tasks. Client and referral summary designs are retained.</p><div class="meta">Branch <code>codex/guided-test-collection-review</code> · source <code>54f5d58</code> · application code unchanged · fictional examples</div>
<nav class="nav" role="tablist" aria-label="Review sections"><button type="button" role="tab" id="screens-tab" aria-controls="screens-panel" aria-selected="true" data-panel="screens-panel">Screen concepts</button><button type="button" role="tab" id="flow-tab" aria-controls="flow-panel" aria-selected="false" data-panel="flow-panel">Workflow chart</button><button type="button" role="tab" id="behavior-tab" aria-controls="behavior-panel" aria-selected="false" data-panel="behavior-panel">Behavior & guards</button><button type="button" role="tab" id="plan-tab" aria-controls="plan-panel" aria-selected="false" data-panel="plan-panel">Delivery plan</button></nav></header>
<main>
<section class="panel" role="tabpanel" id="screens-panel" aria-labelledby="screens-tab">
<div class="toolbar"><div class="control"><label for="filter">Collection path</label><select id="filter"><option value="All">All __COUNT__ concepts</option><option value="Instant">Instant path</option><option value="Lab">Lab path</option><option value="Payment">Payment states</option><option value="Staff">Staff views &amp; sidebar</option></select></div><div class="control" style="flex:2"><label for="screen">Screen or state</label><select id="screen"></select></div><div class="browse"><button id="prev" type="button" aria-label="Previous screen">← Previous</button><button id="next" type="button" aria-label="Next screen">Next →</button><span id="count" class="count"></span></div></div>
<div class="viewer-head"><h2 id="screen-title">Generate & upload report</h2><span class="group" id="group">Instant</span></div><p class="note" id="note"></p><img id="screen-image" class="screen-img" src="images/07-generate-upload-report.png" alt="Proposed combined generate and upload report screen"><div class="links"><a id="full-image" href="images/07-generate-upload-report.png" target="_blank" rel="noopener">Open image at full size</a><a href="README.md">Full flow map and code evidence</a><a href="prompts.json">First prompts</a><a href="refinement-prompts.json">Revision prompts</a></div>
<footer>Generated concepts show independent examples and state variants. Required warnings and confirmation decisions remain visible. The progress row represents phases; implementation must use actual completion state.</footer></section>

<section class="panel" role="tabpanel" id="flow-panel" aria-labelledby="flow-tab" hidden><h2>Shared start, two collection branches</h2><p class="quiet">Switch between the observed code flow and the proposed flow. Dashed paths show exceptions or recovery. On a narrow screen, scroll the chart sideways for readable labels.</p><div class="flow-tabs"><button type="button" class="active" data-chart="current-flow.svg">Current flow</button><button type="button" data-chart="proposed-flow.svg">Proposed flow</button></div><div class="flow"><img id="chart" src="current-flow.svg" alt="Current flow chart with shared client and payment steps, then instant and lab branches"></div><div class="links"><a id="full-chart" href="current-flow.svg" target="_blank" rel="noopener">Open full-size chart</a><a href="README.md">Every variable, guard and code reference</a></div></section>

<section class="panel body-copy" role="tabpanel" id="behavior-panel" aria-labelledby="behavior-tab" hidden><h2>The changes that matter</h2><div class="recommend"><strong>Generate & upload the instant report in one place.</strong><p>ToxAccess stays in another tab. When staff return, the screen still says Waiting for PDF until a file is attached. A focus event, tab closure, or Donor ready status never proves report generation. Extraction and name checks follow the upload.</p></div><div class="table-wrap"><table><thead><tr><th>State</th><th>What staff see</th><th>What must remain true</th></tr></thead><tbody>
<tr><td>Client owes</td><td>Clear amount due, amount received, cash/card/credit actions</td><td>Older eligible client balances first; zero payment with debt requires acknowledgement.</td></tr>
<tr><td>Today prepaid, no old client debt</td><td>No payment needed; $0 remaining; Add account credit collapsed</td><td>Continuation still preserves the existing payment/booking bookkeeping.</td></tr>
<tr><td>Today prepaid, older client debt exists</td><td>Today's test prepaid plus separate previous client balance</td><td>Do not imply the entire account owes nothing.</td></tr>
<tr><td>Credit available</td><td>Explicit Apply credit action</td><td>Available credit is not payment until applied; allocation behavior unchanged.</td></tr>
<tr><td>Invoice-enabled referral, switch ON</td><td>Referral will be invoiced; client due for this test is zero</td><td>Keep a per-test payer/referral snapshot; referral billing is not a paid status.</td></tr>
<tr><td>Same referral, switch OFF</td><td>Client pays this test; ordinary payment controls</td><td>Exclude this test from referral invoices even if unpaid; allow tracker follow-up payments.</td></tr>
<tr><td>Missing report</td><td>Generate and upload area; disabled Review uploaded report</td><td>Stay at the same booking. No guessed report readiness or repeated payment.</td></tr>
<tr><td>Parsing or client mismatch</td><td>Visible error/warning and report/client comparison</td><td>Retain severity and explicit acknowledgement; replacement invalidates stale confirmation.</td></tr>
<tr><td>Unexpected positive</td><td>Accept / request confirmation / decide later</td><td>Required decision/substances remain visible and server-validated.</td></tr>
<tr><td>Lab collection</td><td>Medications, date/test/BAC, referral notification</td><td>No negative result or instant PDF inferred; lab results arrive later.</td></tr>
<tr><td>Created test but email failed</td><td>Saved record plus delivery issue</td><td>Recover delivery without inviting duplicate creation.</td></tr>
</tbody></table></div><h3>Simple steps, one fact in one place</h3><p>Today shows appointments without the added Follow-up panel. Prepare shows client context and the generate/upload tasks, without medication content. Medications appear in their own verification checkpoint. Results use one compact labeled color strip and short decision choices; final review repeats only client/result context, then recipients and the report. Payment and full detail recaps are removed.</p><p>Green can mean negative or expected-positive; keep the label accurate. Yellow indicates a warning or pending review; red flags unexpected or critical findings. Loading or missing results never appear negative or ready. Classification and server checks remain unchanged.</p><h3>Occasional edits stay available</h3><p>Keep client, headshot, test, referral, medication and recipient edits. Test changes must reconcile payment and routing. Keep missing-client registration's existing five steps. Collapse optional test edits, diagnostics and prepayment; keep required errors, identity checks and confirmation choices expanded. Open the affected disclosure and focus its field when validation fails.</p><p class="quiet">Instant reload currently resets the workflow. Full draft recovery is separate work; these concepts do not claim autosave.</p><div class="links"><a href="README.md">Full variable matrix, active test types and source evidence</a></div></section>

<section class="panel body-copy" role="tabpanel" id="plan-panel" aria-labelledby="plan-tab" hidden><h2>Separate the changes by risk</h2><ol><li><strong>Interface and recoverable Back.</strong> Normalize titles/values, make prepaid payment optional, and return from collection entry to the same appointment's preparation. Retain validators, payment allocation and creation actions.</li><li><strong>Combined instant report screen.</strong> Reuse the existing upload form alongside ToxAccess instructions/link; remove one preparation screen. Keep extraction, medications, result verification and email review.</li><li><strong>Per-test payer backend.</strong> Persist responsibility on the booking and test, filter invoices and client allocation correctly, and update tracker payment rules. Expose the switch only with that complete backend contract.</li></ol><p><span class="pill">Current baseline: 6 suites · 51 tests passed</span></p><p>The reviewed suites cover payment allocation, snapshots, schedule routing, report/client matching and referral invoices. They validate existing code, not the unimplemented proposals. No live collections, charges, emails, migrations, build or E2E run occurred.</p><p>First preserve the business checkpoints. Removing medication or final notification review is not recommended in this pass. Combining upload with extraction can be considered later once validation and recovery are characterized.</p><div class="links"><a href="../006-guided-collection-interface.md">Plan 006: UI and navigation</a><a href="../007-per-test-payment-responsibility.md">Plan 007: payer responsibility</a><a href="../008-staff-navigation-and-summary-views.md">Plan 008: staff views and account payments</a><a href="README.md">Detailed evidence and verification notes</a></div><p class="quiet">This is a design review. Source changes wait for the user's review. All proposals retain feature-branch PRs and required CI.</p></section>
</main><script>
const screens=__SCREENS__;
const filter=document.getElementById('filter'), selector=document.getElementById('screen');
let visible=screens.slice();
function show(){const item=visible[selector.selectedIndex]||visible[0];document.getElementById('screen-title').textContent=item.title;document.getElementById('group').textContent=item.group;document.getElementById('note').textContent=item.note;const image=document.getElementById('screen-image');image.src=item.src;image.alt='Generated design concept: '+item.title;document.getElementById('full-image').href=item.src;document.getElementById('count').textContent=(selector.selectedIndex+1)+' / '+visible.length;document.getElementById('prev').disabled=selector.selectedIndex===0;document.getElementById('next').disabled=selector.selectedIndex===visible.length-1;}
function populate(prefer='__DEFAULT_ID__'){const kind=filter.value;visible=screens.filter(s=>kind==='All'||s.group===kind||(kind==='Staff'&&s.id.startsWith('18-staff'))||((kind==='Instant'||kind==='Lab')&&(s.group==='Shared'||s.group==='Payment')));selector.replaceChildren(...visible.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.title;return o}));const i=visible.findIndex(s=>s.id===prefer);selector.selectedIndex=i<0?0:i;show();}
filter.addEventListener('change',()=>populate(selector.value));selector.addEventListener('change',show);document.getElementById('prev').addEventListener('click',()=>{selector.selectedIndex--;show()});document.getElementById('next').addEventListener('click',()=>{selector.selectedIndex++;show()});
document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-panel]').forEach(tab=>{const on=tab===button;tab.setAttribute('aria-selected',String(on));document.getElementById(tab.dataset.panel).hidden=!on});}));
document.querySelectorAll('[data-chart]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-chart]').forEach(b=>b.classList.toggle('active',b===button));document.getElementById('chart').src=button.dataset.chart;document.getElementById('chart').alt=button.dataset.chart==='current-flow.svg'?'Observed current collection workflow chart':'Proposed collection workflow chart';document.getElementById('full-chart').href=button.dataset.chart;}));populate(new URLSearchParams(location.search).get('screen')||'__DEFAULT_ID__');
</script></body></html>'''

(ROOT / "current-flow.svg").write_text(chart(), encoding="utf-8")
(ROOT / "proposed-flow.svg").write_text(chart(True), encoding="utf-8")
(ROOT / "review.html").write_text(template.replace("__SCREENS__", json.dumps(data, ensure_ascii=False)).replace("__COUNT__", str(len(data))).replace("__DEFAULT_ID__", default_screen), encoding="utf-8")
(ROOT / "screens.json").write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Built {len(data)} screen concepts and two charts in {ROOT}")
