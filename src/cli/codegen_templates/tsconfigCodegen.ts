export function tsconfigCodegen() {
  return `{
    /* This TypeScript project config describes the environment that
     * Firestore functions run in and is used to typecheck them.
     * You can modify it, but some settings are required to use Firestore.
     */
    "compilerOptions": {
      /* These settings are not required by Firestore and can be modified. */
      "allowJs": true,
      "strict": true,
      "moduleResolution": "Bundler",
      "jsx": "react-jsx",
      "skipLibCheck": true,
      "allowSyntheticDefaultImports": true,
  
      /* These compiler options are required by Firestore */
      "target": "ESNext",
      "lib": ["ES2021", "dom"],
      "forceConsistentCasingInFileNames": true,
      "module": "ESNext",
      "isolatedModules": true,
      "noEmit": true,
    },
    "include": ["./**/*"],
    "exclude": ["./_generated"]
  }`;
}
