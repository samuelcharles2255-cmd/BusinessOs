#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    # If run using global Python, automatically delegate to the project venv if present
    venv_python = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "venv", "Scripts", "python.exe")
    )
    if os.path.exists(venv_python) and os.path.abspath(sys.executable).lower() != venv_python.lower():
        import subprocess
        sys.exit(subprocess.call([venv_python] + sys.argv))

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'BusinessSys.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
