import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * eslint-config-next is flat-config native, so it is imported directly rather
 * than through @eslint/eslintrc's FlatCompat (which throws a circular-JSON
 * error on Next 16).
 */
const eslintConfig = [
  ...coreWebVitals,
  ...nextTypescript,
  { ignores: [".next/**", "node_modules/**"] },
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Import from @ketryon/db instead — the data layer owns both clients.",
            },
            {
              // The privileged subpath bypasses RLS. Jobs use it; apps never do.
              name: "@ketryon/db/jobs",
              message:
                "@ketryon/db/jobs uses the service role and has no session. App code must use the session-first DAL from @ketryon/db.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
