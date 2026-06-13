import { PromptNotFoundError, MissingPromptInputError } from "./errors";

const TEMPLATE_REGEX = /\{(\w+)\}/g;

export class PromptRegistry {
  private templates = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    if (initial) {
      for (const [name, template] of Object.entries(initial)) {
        this.templates.set(name, template);
      }
    }
  }

  set(name: string, template: string): void {
    this.templates.set(name, template);
  }

  get(name: string): string | undefined {
    return this.templates.get(name);
  }

  render(name: string, inputs: Record<string, string>): string {
    const template = this.templates.get(name);
    if (template === undefined) {
      throw new PromptNotFoundError(name);
    }
    return template.replace(TEMPLATE_REGEX, (match, key) => {
      if (!(key in inputs)) {
        throw new MissingPromptInputError(key, name);
      }
      return inputs[key]!;
    });
  }

  has(name: string): boolean {
    return this.templates.has(name);
  }

  entries(): [string, string][] {
    return Array.from(this.templates.entries());
  }

  clear(): void {
    this.templates.clear();
  }
}
