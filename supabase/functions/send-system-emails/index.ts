import { handleSystemEmails } from './handler.ts';

Deno.serve((request) => handleSystemEmails(request));
