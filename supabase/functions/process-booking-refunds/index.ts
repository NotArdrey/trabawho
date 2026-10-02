import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleBookingRefundRequest } from "./handler.ts";

serve(handleBookingRefundRequest);
