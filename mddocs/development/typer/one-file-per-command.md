# One File Per Command

When your CLI application grows, you can split it into multiple files and modules. This pattern helps maintain a clean and organized code structure. ✨

This tutorial will show you how to use `add_typer` to create sub commands and organize your commands in multiple files.

We will create a simple CLI with the following commands:

* `version`
* `users add NAME`
* `users delete NAME`

---

## CLI structure

Here is the structure we'll be working with:

```text
mycli/
├── __init__.py
├── main.py
├── users/
│   ├── __init__.py
│   ├── add.py
│   └── delete.py
└── version.py

```

`mycli` will be our package, and it will contain the following modules:

* **main.py**: The main module that will import the version and users modules.
* **version.py**: A module that will contain the version command.
* **users/**: A package (inside of our mycli package) that will contain the add and delete commands.

---

## Implementation

Let's start implementing our CLI! 🚀
We'll create the version module, the main module, and the users package.

### Version Module (version.py)

Let's start by creating the version module. This module will contain the version command.

```python
import typer

app = typer.Typer()

@app.command()
def version():
  print("My CLI Version 1.0")

```

In this file we are creating a new Typer app instance for the version command. This is not required in single-file applications, but in the case of multi-file applications it will allow us to include this command in the main application using `app.add_typer()`.

### Main Module (main.py)

The main module will be the entry point of the application. It will import the version module and the users module.

```python
import typer
from .users import app as users_app
from .version import app as version_app

app = typer.Typer()

app.add_typer(version_app)
app.add_typer(users_app, name="users")

if __name__ == "__main__":
  app()

```

In this module, we import the version and users modules and add them to the main app using `app.add_typer()`.

For the **users** module, we specify the name as "users" to group the commands under the users sub-command. Notice that we didn't add a name for the `version_app`. Because of this, Typer will add the commands directly at the top level.

> **Tip:** If you want a command to group the included commands in a sub-app, add a name. If you want to include the commands from a sub-app directly at the top level, don't add a name, or set it to `None`. 🤓

### Users Add Command (users/add.py)

```python
import typer

app = typer.Typer()

@app.command()
def add(name: str):
  print(f"Adding user: {name}")

```

### Users Delete Command (users/delete.py)

```python
import typer

app = typer.Typer()

@app.command()
def delete(name: str):
  print(f"Deleting user: {name}")

```

### Users' app (users/**init**.py)

Finally, we need to create an `__init__.py` file in the users directory to define the users app.

```python
import typer
from .add import app as add_app
from .delete import app as delete_app

app = typer.Typer()

app.add_typer(add_app)
app.add_typer(delete_app)

```

---

## Callbacks

Have in mind that if you include a sub-app with `app.add_typer()` *without a name*, the commands will be added to the top level, so *only the top level callback* (if there's any) will be used.

If you *want to use a callback* for a sub-app, you need to include the sub-app *with a name*, which creates a sub-command grouping the commands in that sub-app. 🤓

Would you like me to explain how to add a `callback` to the `users` group we just created?
