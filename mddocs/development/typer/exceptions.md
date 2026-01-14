# Exceptions and Errors

When your code has errors and you run it, it will show the error and an exception. Typer does some tricks to help you detect those errors quickly.

## Example Broken App

Let's take this example broken app:

```python
import typer

app = typer.Typer()

@app.command()
def main(name: str = "morty"):
  print(name + 3)

if __name__ == "__main__":
  app()

```

This code is broken because you can't sum a string and a number (`name + 3`).

## Exceptions with Rich

If you have **Rich** installed (for example if you installed `"typer[all]"`), **Typer** will use it to automatically show you nicely printed errors.

It will **omit** all the parts of the traceback (the chain of things that called your function) that come from the internal parts in Typer and Click. So, the error you see will be **much clearer** and simpler, to help you detect the problem in your code quickly:

```bash
$ python main.py
Traceback (most recent call last)
/home/user/code/superapp/main.py:8 in main
  5
  6 @app.command()
  7 def main(name: str = "morty"):
❱ 8   print(name + 3)
  9
 10
 11 if __name__ == "__main__":

  locals
  name = 'morty'

TypeError: can only concatenate str (not "int") to str

```

## Exceptions without Rich

If you don't have Rich installed, Typer will still do some tricks to show you the information **as clearly as possible**.

## Disable Local Variables for Security

If your Typer application handles **delicate information**, for example a **password**, a **key**, or a **token**, then it could be problematic if the automatic errors show the value in those local variables. This would be relevant in particular if your CLI application is being run on some CI (continuous integration) system that is recording the logs.

The default errors above, when using Rich, show a section with `name = 'morty'`. To hide this, you can set the parameter `pretty_exceptions_show_locals=False` when creating the `typer.Typer()` application:

```python
import typer

app = typer.Typer(pretty_exceptions_show_locals=False)

@app.command()
def main(password: str):
  print(password + 3)

if __name__ == "__main__":
  app()

```

Now when you run it, you will see the error without the local variables. Note that even if you passed a password like `supersecret`, it won't be shown in the error message.

## Disable Short Output

If you want to show the full exception, including the parts in Typer and Click, you can use the parameter `pretty_exceptions_short=False`:

```python
import typer

app = typer.Typer(pretty_exceptions_short=False)

@app.command()
def main(name: str = "morty"):
  print(name + 3)

if __name__ == "__main__":
  app()

```

## Disable Pretty Exceptions

You can also entirely disable pretty exceptions with the parameter `pretty_exceptions_enable=False`:

```python
import typer

app = typer.Typer(pretty_exceptions_enable=False)

@app.command()
def main(name: str = "morty"):
  print(name + 3)

if __name__ == "__main__":
  app()

```

You could also achieve the same with the environment variable `TYPER_STANDARD_TRACEBACK=1`.
