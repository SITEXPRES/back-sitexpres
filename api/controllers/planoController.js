import axios from "axios";
import ftp from "basic-ftp";
import { Readable } from "stream";
import https from "https";
import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

export async function consultaPlano(id_user) {
    try {
        const resultUser = await pool.query(
          `SELECT plan, is_active 
           FROM public.user_subscriptions 
           WHERE user_id = $1 
           ORDER BY id DESC
           LIMIT 1`,
          [id_user]
        );

        if (resultUser.rows.length === 0) {
          return {
            isPro: false,
            isActive: false,
            plan: "free"
          };
        }

        const user = resultUser.rows[0];
        const isActive = !!user.is_active;
        const isPro = isActive && user.plan !== "free";

        return {
          isPro,
          isActive,
          plan: user.plan || "free"
        };
      } catch (error) {
        console.error("Erro ao consultar plano:", error);
        return {
          isPro: false,
          isActive: false,
          plan: "free"
        };
      }
}

