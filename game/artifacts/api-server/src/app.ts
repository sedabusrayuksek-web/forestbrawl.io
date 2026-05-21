import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const runtimeDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve Forest Brawl game static files
// runtimeDir is artifacts/api-server/dist/ at runtime
// Build output is at ../../forestbrawl/dist/public/
const gameRoot = join(runtimeDir, "../../forestbrawl/dist/public");
app.use("/forestbrawl", express.static(gameRoot));

export default app;
