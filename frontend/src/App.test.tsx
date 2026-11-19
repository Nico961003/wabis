import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("public app", () => {
  it("renders the catalog shell", () => {
    const html = renderToString(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(html).toContain("Wabis");
    expect(html).toContain("Catálogo");
  });
});
