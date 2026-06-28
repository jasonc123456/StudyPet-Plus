// Auth.js catch-all route handler.
//
// Auth.js needs HTTP endpoints under /api/auth/* (e.g. the magic-link
// verification callback the emailed link points at). `handlers` from
// src/auth.ts bundles the GET and POST handlers we re-export here.

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
