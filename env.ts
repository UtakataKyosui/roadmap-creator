import { defineEnv, url } from "void/env";

export default defineEnv({
  API_ORIGIN: url().default("http://localhost:3000"),
});
