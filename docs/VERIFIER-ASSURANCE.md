# Receipt inspection and assurance boundaries

The 1.3.1 release corrects the draft payload inspector's assurance labels. It
uses a new immutable version rather than replacing a published package.

`receipts.scitt_profile` verifies the underlying receipt using the reported
verification mode, computes its canonical digest, and compares an optional
`expected_head` supplied by the caller. The legacy `anchored_head` argument is
an alias for that comparison. A match says that the supplied bytes agree; the
caller still owns the expected head's provenance, durable custody and freshness.

A bundle's `chain_head` is an in-band declaration. Its comparison is reported
separately from caller expectations. An attached `scitt.cose_receipt` is reported
as attached, without interpreting it as a valid transparency-service receipt.
This package does not verify COSE inclusion proofs or authenticate an external
anchor, and it does not implement an operator's retention or authority policy.

`anchored_head_verified`, `scitt_cose_receipt_verified`, and the three
`consumer_profiles` values are therefore `null` when not evaluated. Invalid
base verification can rule out a consumer profile (`false`), but a matching
digest or an object named `anchors` cannot establish that profile (`true`).
`structural_checks.authority_grant_precedes_execution` describes record order
only; it does not authenticate real-world authority. This is an individual
Internet-Draft payload inspector, not a claim of IETF adoption or SCITT
registration.

When the optional `continuity-receipt` reference package is absent, bundle
verification explicitly reports `integrity-only` and does not evaluate semantic
conformance. Native WhiteMagic emitted-receipt checks keep their separate
`wm-profile-exact` mode. Neither mode establishes truth, completeness, payment
finality, tenant isolation or independent operation.

The optional reference must be the supported 0.1.2-or-later 0.1 patch line before
this dispatcher delegates full CPR conformance. Published 0.1.1 accepted signed
impossible Gregorian dates and is deliberately ineligible. Missing, older,
unknown and incompatible versions retain explicitly labelled integrity-only
checking; that mode does not establish full protocol conformance. Its issued_at
check now rejects calendar overflow and trailing-newline spellings. The default
optional package pin is 0.1.2, qualified through the installed package integration
before this release. Node versions without module-URL resolution also take the
conservative integrity-only path.

The signed timestamp boundary fixture is copied from the Apache-2.0 CPR test
vectors, with its source kept in the release review packet; the fixture key is
public and synthetic. It is a regression input, not independently authored
conformance evidence.
