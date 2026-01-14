# CLI Application Directory

You can get the application directory where you can, for example, save configuration files with `typer.get_app_dir()`:

### Python 3.9+

```python
from pathlib import Path

import typer

APP_NAME = "my-super-cli-app"

app = typer.Typer()


@app.command()
def main():
  app_dir = typer.get_app_dir(APP_NAME)
  config_path: Path = Path(app_dir) / "config.json"
  if not config_path.is_file():
    print("Config file doesn't exist yet")


if __name__ == "__main__":
  app()

```

It will give you a directory for storing configurations appropriate for your CLI program for the current user in each operating system.

Check it:

```bash
$ python main.py

Config file doesn't exist yet

```

---

## About Path

If you hadn't seen something like that:

`Path(app_dir) / "config.json"`

A `Path` object can be used with `/` and it will convert it to the separator for the current system (`/` for Unix systems and `\` for Windows).

If the first element is a `Path` object the next ones (after the `/`) can be `str`.

And it will create a new `Path` object from that.

If you want a quick guide on using `Path()` you can check [this post on Real Python](https://realpython.com/python-pathlib/) or [this post by Trey Hunner](https://treyhunner.com/2018/12/why-you-should-be-using-pathlib/).

In the code above, we are also explicitly declaring `config_path` as having type `Path` to help the editor provide completion and type checks:

`config_path: Path = Path(app_dir) / "config.json"`

Otherwise it could think it's a sub-type (a `PurePath`) and stop providing completion for some methods.
