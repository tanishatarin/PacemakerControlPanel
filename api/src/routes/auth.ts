import { Hono } from "hono";

const authRoutes = new Hono();

authRoutes.post("/sign-in", async (c) => {
	const { username, password } = await c.req.json();
	console.log({ username, password });
	return c.json({ message: "You have been signed in!" });
});

authRoutes.post("/sign-up", async (c) => {
	const { name, username, password } = await c.req.json();
	console.log({ name, username, password });
	return c.json({ message: "You have been signed up!" }, 201);
});

authRoutes.post("/sign-out", async (c) => {
	return c.json({ message: "You have been signed out!" });
});

export default authRoutes;
