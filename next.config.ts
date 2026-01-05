import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    DATABASE_URL:
      "postgresql://neondb_owner:npg_NuZ8XaWnHm5M@ep-rapid-bread-ad2x5b1b-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    API_KEY: "AIzaSyA88X1iD8qIJOeVjDRU-KQbcsAnG3035Ko",
  },
};

export default nextConfig;
