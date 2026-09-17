jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock("../../src/integrations/config", () => ({ getGroqConfig: jest.fn() }));

const axios = require("axios");
const { getGroqConfig } = require("../../src/integrations/config");
const { generateAnswer } = require("../../src/utils/llm");

describe("utils/llm generateAnswer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { choices: [{ message: { content: "answer" } }] } });
  });

  it("calls Groq with the resolved key, model and temperature", async () => {
    getGroqConfig.mockResolvedValue({ apiKey: "gsk_pizza", model: "llama-3.1-8b-instant", temperature: 0.5 });

    await expect(generateAnswer("price?", [])).resolves.toBe("answer");

    const [, body, options] = axios.post.mock.calls[0];
    expect(body).toMatchObject({ model: "llama-3.1-8b-instant", temperature: 0.5 });
    expect(options.headers.Authorization).toBe("Bearer gsk_pizza");
  });

  it("fails when no key is available", async () => {
    getGroqConfig.mockResolvedValue({ apiKey: undefined, model: "m", temperature: 0.3 });
    await expect(generateAnswer("q", [])).rejects.toThrow(/not configured/i);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
