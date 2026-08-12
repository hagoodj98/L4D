import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const forumPartialPath = path.resolve("views/partials/forum.ejs");

function extractHandlePostSubmitBlock(source) {
  const start = source.indexOf("async function handlePostSubmit");
  const end = source.indexOf("async function handleReplySubmit");
  if (start === -1 || end === -1 || end <= start) {
    return "";
  }
  return source.slice(start, end);
}

describe("Forum script regressions", () => {
  it("applies new-post class when adding a new post", () => {
    const source = fs.readFileSync(forumPartialPath, "utf8");
    const block = extractHandlePostSubmitBlock(source);

    expect(block).toContain(
      'const insertedPost = postsContainer.querySelector(".new-post")',
    );
    expect(block).not.toContain(".new-reply");
  });
});
