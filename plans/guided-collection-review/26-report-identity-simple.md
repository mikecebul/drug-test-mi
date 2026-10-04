# Report identity comparison

Approved October 4, 2026. Generated with the built-in imagegen tool, refined after review to remove paragraphs, radio choices and duplicate acknowledgements.

Reference: `images/26-report-identity-simple.png`.

Final prompt: Keep the minimal white/blue workflow and compact client headshot. In the amber identity comparison, state exactly which fields differ: “Name and birth date don't match” for this example. Use a compact table with labeled columns “Website client” and “ToxAccess report” and rows “Name” and “Birth date.” Highlight only the differing surname and day. Keep one unchecked “This is the same person” checkbox, Replace PDF/View PDF links, compact red unexpected-positive strip, collapsed Report details, Back to upload and disabled Continue until confirmed. No explanatory paragraphs, radio choices, extra buttons or IDs.

Implementation varies the heading according to actual differences. Only parsed report birth dates are displayed; absent DOB does not become an invented mismatch. Missing/unreadable identity values require manual PDF review. Report replacement, another client, or an identity edit invalidates the confirmation. This confirmation never links, merges or corrects a ToxAccess donor automatically.
