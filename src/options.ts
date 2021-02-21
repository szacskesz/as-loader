// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAscOptionsToArgs(options: Record<string, any>): string[] {
  const args = [];
  for (const key in options) {
    if (typeof options[key] === "boolean") {
      args.push("--" + key);
    } else if (
      typeof options[key] === "string" ||
      typeof options[key] === "number"
    ) {
      args.push("--" + key, String(options[key]));
    } else if (Array.isArray(options[key])) {
      args.push("--" + key, options[key].join(","));
    } else if (typeof options[key] === "object" && options[key] !== null) {
      args.push(...mapAscOptionsToArgs(options[key]));
    }
  }
  return args;
}

export { mapAscOptionsToArgs };
