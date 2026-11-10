-- Public registration asks for the advisor's agency as an optional profile field.
ALTER TABLE "users" ADD COLUMN "agency" VARCHAR(120);
