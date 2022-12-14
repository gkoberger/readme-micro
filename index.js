/* We'll make this better eventually, but for now we'll make it quickly! */

const fs = require("fs");
const path = require("path");

const github = require("@actions/github").context;
const core = require("@actions/core");

const utils = require("./utils");

const swaggerInline = require("swagger-inline");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const axios = require("axios");

(async () => {
  const commandLineArgs = require("command-line-args");
  const options = commandLineArgs([
    { name: "src", type: String, multiple: true, defaultOption: true },
    { name: "key", alias: "k", type: String },
  ]);

  const src = utils.listOas(options.src);

  let out = {
    markdown: undefined, // micro.md file

    // For legacy reasons, we support 1 in oas
    // To make supporting multiple easier eventuall,
    // we also save them to `specs`.
    oas: undefined,
    specs: [], // the specs {filename, oas}

    ref: github.ref,
    sha: github.sha,
    actor: github.actor,
    runId: github.runId,
    payload: github.payload,
  };

  const markdown = path.join(process.cwd(), `micro.md`);
  if (fs.existsSync(markdown)) {
    out.markdown = fs.readFileSync(markdown, "utf8");
  }

  for (var i = 0; i < src.length; i++) {
    var fileName = src[i];
    const file = path.join(process.cwd(), fileName);
    if (fs.existsSync(file)) {
      let oas;
      if (fileName === "api.config.json") {
        const prepare = await import('./api.js/prepare.js');
        oas = JSON.stringify((await prepare.default(process.cwd())).oas, undefined, 2);
      } else {
        /* TODO: I would love Swagger Inline to eventually
         * use a glob from the OAS file itself, so hopefully
         * eventually we can do that!
         *
         * Like this:
         *
         *   path: '**\/*.js'
         *
         * */

        oas = await swaggerInline(["**/*"], {
          base: file,
        });
      }

      out.specs.push({
        fileName,
        oas,
      });
    }
  }

  // This should go away when we support multiple
  if (out.specs.length) {
    out.oas = out.specs[0];
  }

  /*
   github:
{
  context: Context {
    payload: {
      after: '3a8104d3929667a7c0da046dd1f4ac242d9dbf81',
      base_ref: null,
      before: '2bb1c3a8818cf5108f4ffee5c83d8779d788aa25',
      commits: [Array],
      compare: 'https://github.com/ReadMe-Micro-Test/repo-for-dave-demo/compare/2bb1c3a8818c...3a8104d39296',
      created: false,
      deleted: false,
      forced: false,
      head_commit: [Object],
      organization: [Object],
      pusher: [Object],
      ref: 'refs/heads/main',
      repository: [Object],
      sender: [Object]
    },
    eventName: 'push',
    sha: '3a8104d3929667a7c0da046dd1f4ac242d9dbf81',
    ref: 'refs/heads/main',
    workflow: 'ReadMe Microservices',
    action: '__gkoberger_readme-micro',
    actor: 'gkoberger',
    job: 'sync',
    runNumber: 10,
    runId: 2988893780,
    apiUrl: 'https://api.github.com',
    serverUrl: 'https://github.com',
    graphqlUrl: 'https://api.github.com/graphql'
  },
  getOctokit: [Function: getOctokit]
}
*/

  //console.log(spec);

  //console.log(options, src);

  //console.log(process.env);
  const base = process.env.BASE_URL || "https://micro.readme.build";

  axios
    .post(`${base}/api/uploadSpec`, out, {
      headers: { "X-API-KEY": options.key },
    })
    .then((response) => {
      console.log(response.data.url);
      console.log(response.data.explanation);
    })
    .catch((error) => {
      console.log(error);
      core.setFailed(error.message);
    });
})();
