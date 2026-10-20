import { db } from "void/db";
import type { Db } from "./db";

// void/dbの型はプロジェクトのスキーマを参照できないため、実行時に使われるスキーマの型を明示する。
export const database = db as unknown as Db;
