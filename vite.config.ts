import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
	plugins: [
		react({
			// Also transform JSX in .js files so Vite's import analysis doesn't choke
			include: [/\.jsx$/, /\.tsx$/, /\.js$/],
		}),
		runtimeErrorOverlay(),
		themePlugin(),
		...(process.env.NODE_ENV !== "production" &&
		process.env.REPL_ID !== undefined
			? [
					await import("@replit/vite-plugin-cartographer").then((m) =>
						m.cartographer(),
					),
				]
			: []),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "client", "src"),
			"@shared": path.resolve(__dirname, "shared"),
		},
		extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".mts", ".json"],
	},
	root: path.resolve(__dirname, "client"),
	optimizeDeps: {
		force: true,
		include: [
			"react",
			"react-dom",
			"@tanstack/react-query",
			"wouter",
			"lucide-react",
			"framer-motion",
			"radix-ui-*",
			"date-fns",
			"class-variance-authority",
			"clsx",
			"tailwind-merge"
		],
		exclude: [
			"canvas",
			"sharp",
			"pdf-lib",
			"pdfjs-dist",
			"jszip"
		],
		esbuildOptions: {
			loader: {
				".js": "jsx",
			},
		},
	},
	build: {
		outDir: path.resolve(__dirname, "dist/public"),
		emptyOutDir: true,
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
			},
		},
	},
});
