import { BRIDGES } from "./bridges";
import * as express from "express";

const port = process.env.PORT || "8080";

async function main() {
  console.log("==> Starting Acheron Oracle");
  console.log("==> Found", BRIDGES.length, "bridges to monitor and sign");

  const app: express.Application = express();

  for (let i = 0; i < BRIDGES.length; i++) {}

  console.log("==> Listening on", port);
  app.listen(port);
}

main().catch((e) => console.log(e));
