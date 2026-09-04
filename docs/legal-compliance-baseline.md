# Legal compliance baseline

> Research baseline for the public documentation site and API access request
> flow. This is not legal advice. Confirm the controller's establishment,
> audience, provider contracts, and final notices with qualified counsel before
> launch. Sources were accessed on 2026-09-04.

## Scope and jurisdiction

- The access form processes personal data: names, email address, country,
  occupation, use-case selections, optional free text, and operational data
  such as request IDs and logs.
- GDPR territorial scope is determined first under Article 3. It can apply to
  an EU-established controller and, in some circumstances, to a controller
  outside the EU that offers services to or monitors people in the EU. If the
  controller is outside the EU and Article 3(2) applies, assess the Article 27
  representative requirement. [GDPR]
- The Spanish LSSI-CE and LOPDGDD analysis below is conditional. Confirm where
  the controller is established and whether the service is directed at Spain
  before treating Spanish-specific obligations as applicable. LOPDGDD
  supplements the GDPR where its Spanish scope applies. [LSSI-CE] [LOPDGDD]

## Repository observations

The inspected implementation and feature contract show:

- `src/components/ApiKeyRequestDialog.tsx` collects first name, last name,
  email, country, occupation, use case, and conditional `useCaseDetails`.
- The dialog displays a first-layer purpose summary and links to the draft privacy
  notice and draft API terms. The inspected form has no separate consent control;
  the linked drafts are not a substitute for the final Article 13 notice.
- `src/pages/api/key-requests.ts` processes submissions server-side. The
  planned flow stores request data in Turso and sends intake/decision emails
  through Resend. The contract says issued API keys are not stored or logged.
- Country options are fetched server-side from Nager.Date. Item images can be
  requested directly by the browser from external `imageUrl` hosts. These
  providers and their retention/transfer practices belong in the data-flow
  inventory; the Nager/image-host terms were not independently verified here.
- The contract uses hashed IP/email rate-limit identifiers and says raw IPs are
  not persisted. A hash is not automatically anonymous: treat it as personal
  data where it remains reasonably linkable. [GDPR]

## EU GDPR baseline

### Lawful basis and purpose limitation

Document a separate purpose, data set, retention period, recipients, and lawful
basis for at least:

1. receiving and evaluating an API access request;
2. sending the requested intake and decision emails;
3. abuse prevention, rate limiting, security logging, and incident response;
4. administering the queue and proving delivery; and
5. any future product or marketing communication.

Article 6(1)(b) may fit steps taken at the requester's direction before access
is granted; Article 6(1)(f) may fit security and anti-abuse processing after a
documented balancing test. The correct basis depends on the actual relationship
and necessity analysis. Do not use a blanket consent checkbox as a substitute.
If marketing is added, keep it separate from the access request and provide a
lawful opt-in/opt-out path appropriate to the applicable law. [GDPR]

### Notice at collection

Provide a concise first layer beside the form, linked to a complete privacy
notice, before submission. The notice should identify the controller and
contact details; purposes and bases; required versus optional fields and the
consequences of not providing them; recipients/processors; international
transfers and safeguards; retention or its criteria; rights and complaint
route; and whether profiling or automated decision-making is used. [GDPR]
[AEPD information]

The current sentence is useful as a purpose summary but is not a replacement
for Article 13 information. A consent control is not required merely to give
the notice; add one only for a purpose that actually relies on consent.

### Minimisation, free text, and retention

- Keep country, occupation, and use-case details only if each is necessary and
  proportionate to access review, abuse prevention, or a stated compatible
  purpose. Otherwise make the field optional or remove it.
- Tell applicants not to include health, political, religious, biometric, or
  other special-category information in free text. Avoid collecting it rather
  than relying on an Article 9 exception after the fact.
- Set and publish retention criteria for pending/decided requests, email
  content and metadata, database backups, provider logs, rate-limit records,
  hashed identifiers, and security logs. The fact that an API key is ephemeral
  does not make the surrounding email or request record ephemeral. [GDPR]

### Rights, accountability, and security

Maintain a working channel for access, rectification, erasure, restriction,
objection, and portability requests where applicable. Plan for the normal
one-month response period and document identity verification and lawful
exceptions. Keep a lightweight processing record, processor agreements under
Article 28, access controls, encryption, secret management, least privilege,
and a breach process. Assess whether the actual scale or monitoring creates a
high-risk processing operation requiring a DPIA. [GDPR]

## Cookies, device storage, and third-party requests

Article 5(3) of the ePrivacy Directive requires prior informed consent before
storing or accessing information on a user's terminal unless the operation is
strictly necessary to provide a service the user requested. Spain expresses
this rule in LSSI-CE Article 22.2 when that Spanish law applies. [ePrivacy
Directive] [LSSI-CE]

First inventory the built site and runtime: cookies, local/session storage,
pixels, analytics, embedded resources, consent tools, and third-party network
requests. If the site uses only strictly necessary mechanisms (or none), do
not add a banner solely because the form exists. If it uses non-essential
analytics, advertising, personalisation, or tracking, obtain prior granular
opt-in consent, make accept and reject choices equally prominent, and provide
an easy persistent withdrawal mechanism. Keep evidence of the consent's scope,
time, and withdrawal. Do not treat continued browsing or silence as consent.
[GDPR] [AEPD cookies] [AEPD audience]

An external image request is not automatically a cookie, but it can disclose
the visitor's IP address, user agent, referrer, or other request metadata to a
third party. Review whether images can be self-hosted, whether referrers are
controlled, and whether any URL embeds identifiers or tracking pixels.

## Conditional Spanish baseline

If LSSI-CE applies, review at least:

- **Article 2:** territorial scope and establishment analysis.
- **Article 10:** a permanently and freely accessible legal notice with the
  provider's identifying and contact information, plus registry or
  professional details where applicable.
- **Article 21:** commercial electronic communications. Keep request receipts,
  approval/denial messages, and API-key delivery operational; do not append
  product marketing to them. Assess consent, the narrow existing-customer
  exception, identification, and opt-out requirements before sending promotion.
- **Article 22.2:** the information, consent, and exception rules for cookies
  and similar terminal-storage technologies.

For an information-society service directly offered to a child, LOPDGDD
Article 7 sets the Spanish age threshold for the child's own consent at 14,
with parental authorisation required below that age. [LSSI-CE] [LOPDGDD]

## Vendors and international transfers

The current chain needs an account-specific review, not just a vendor logo
list:

| Service | Current relevance | Required verification |
| --- | --- | --- |
| Vercel | Hosting and on-demand server routes; provider logs may contain request metadata. | Confirm plan coverage: the current Vercel DPA states it applies to Pro and Enterprise plans, identifies primary processing facilities in the United States, and provides a subprocessor list. Record the applicable DPA and locations. [Vercel DPA] |
| Turso | Database for API access requests and delivery state. | Execute/confirm the DPA available through the account documents, record the selected database region, backups, subprocessors, and deletion behavior. [Turso terms] [Turso durability] |
| Resend | Transactional email, including recipient addresses, message metadata, and approval-email content. | Confirm the account's DPA, subprocessor list, retention/deletion terms, transfer mechanism, and whether message content is included in provider logs or support access. [Resend DPA] [Resend subprocessors] |
| Nager.Date and image hosts | Server-side country-list request and browser-side image requests. | Confirm controller/processor roles, locations, logs, retention, referrer behavior, and whether self-hosting can reduce disclosure. |

For every transfer outside the EEA, document the Chapter V mechanism: an
adequacy decision where it actually covers the recipient, otherwise an
appropriate Article 46 safeguard such as the Commission's SCCs, plus the
transfer assessment and any supplementary measures. A provider's generic
privacy page or DPF statement is not a substitute for checking the actual
contract, service plan, subprocessor chain, and certification status. [EC
transfers] [EC adequacy] [EC SCCs]

## Before launch

1. Confirm controller identity, establishment, target jurisdictions, EU
   representative/DPO requirements, and complaint authority.
2. Create a data-flow/processing register covering the form, Turso, Resend,
   Vercel logs, Nager.Date, image hosts, backups, cookies, and hashed
   identifiers.
3. Choose and document one lawful basis per purpose; keep marketing separate.
4. Minimise the form, add a free-text special-data warning, and define
   retention/deletion periods for primary and provider records.
5. Publish a layered privacy notice linked at collection and implement a rights
   request process.
6. Inventory terminal storage and third-party requests. Add a compliant
   consent flow only if non-essential technologies are present.
7. Execute/verify Article 28 agreements and international-transfer safeguards;
   record actual regions and subprocessors.
8. Confirm security, breach response, access logging, and DPIA requirements
   before enabling public submissions.

## Primary sources

All sources below were accessed on 2026-09-04.

- **[GDPR]** Regulation (EU) 2016/679, EUR-Lex: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- **[ePrivacy Directive]** Directive 2002/58/EC, EUR-Lex: <https://eur-lex.europa.eu/eli/dir/2002/58/oj>
- **[LSSI-CE]** Spanish Law 34/2002, consolidated BOE text (Articles 2, 10, 21, and 22.2; latest update shown: 2025-01-23): <https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758>
- **[LOPDGDD]** Spanish Organic Law 3/2018, consolidated BOE text (latest update shown: 2025-12-27): <https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673>
- **[AEPD information]** AEPD FAQ on information supplied when data is obtained from the person: <https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion/FAQ-0217-que-informacion-debe-facilitarse-cuando-los-datos-se-obtengan-directamente-del-afectado>
- **[AEPD cookies]** AEPD, *Guía sobre el uso de las cookies*, May 2024: <https://www.aepd.es/guias/guia-cookies.pdf>
- **[AEPD audience]** AEPD, *Guía sobre el uso de cookies para herramientas de medición de audiencia*, January 2024: <https://www.aepd.es/guias/guia-cookies-analiticas-externas.pdf>
- **[EC transfers]** European Commission, rules on international data transfers: <https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en>
- **[EC adequacy]** European Commission, adequacy decisions: <https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en>
- **[EC SCCs]** European Commission, standard contractual clauses: <https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en>
- **[Vercel DPA]** Vercel, Data Processing Addendum: <https://vercel.com/legal/dpa>
- **[Turso terms]** Turso, Terms of Use and account DPA availability: <https://turso.tech/terms-of-use>
- **[Turso durability]** Turso, cloud durability and data-region behavior: <https://docs.turso.tech/cloud/durability>
- **[Resend DPA]** Resend, Data Processing Addendum: <https://resend.com/legal/dpa>
- **[Resend subprocessors]** Resend, subprocessor list: <https://resend.com/legal/subprocessors>

[GDPR]: https://eur-lex.europa.eu/eli/reg/2016/679/oj
[ePrivacy Directive]: https://eur-lex.europa.eu/eli/dir/2002/58/oj
[LSSI-CE]: https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
[LOPDGDD]: https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673
[AEPD information]: https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion/FAQ-0217-que-informacion-debe-facilitarse-cuando-los-datos-se-obtengan-directamente-del-afectado
[AEPD cookies]: https://www.aepd.es/guias/guia-cookies.pdf
[AEPD audience]: https://www.aepd.es/guias/guia-cookies-analiticas-externas.pdf
[EC transfers]: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/rules-international-data-transfers_en
[EC adequacy]: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en
[EC SCCs]: https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en
[Vercel DPA]: https://vercel.com/legal/dpa
[Turso terms]: https://turso.tech/terms-of-use
[Turso durability]: https://docs.turso.tech/cloud/durability
[Resend DPA]: https://resend.com/legal/dpa
[Resend subprocessors]: https://resend.com/legal/subprocessors
