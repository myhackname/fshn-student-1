import serverless from "serverless-http";
import app from "../server";

// Ensure we are in a serverless context
process.env.NETLIFY = "true";

export const handler = serverless(app);
