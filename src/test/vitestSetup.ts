// Give tests a fake browser storage before any store file loads.
import { stubZustandPersistEnv } from "@/test/stubZustandPersistEnv";

stubZustandPersistEnv();
