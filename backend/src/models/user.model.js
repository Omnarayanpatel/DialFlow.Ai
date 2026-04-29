const userSchema = {
  id: "string",
  name: "string",
  email: "string",
  password: "string",
  role: "admin | agent",
  createdAt: "date",
  updatedAt: "date",
};

module.exports = {
  userSchema,
};
