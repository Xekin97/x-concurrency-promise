// rollup.config.js
import typescript from "@rollup/plugin-typescript";

const packageJson = require("./package.json");

const globals = {
	...packageJson.dependencies,
};

export default {
	input: "src/index.ts",
	external: Object.keys(globals),
	output: [
		{
			file: packageJson.main,
			format: "cjs", // commonJS
			sourcemap: true,
		},
		{
			file: packageJson.module,
			format: "esm", // ES Modules
			sourcemap: true,
		},
	],
	plugins: [typescript()],
};
