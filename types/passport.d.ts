import "passport";

// Extend the Express User interface to include custom properties for our application.
declare global {
  namespace Express {
    interface User {
      id: number;
      display_name: string;
      email: string;
      provider: string | undefined;
    }
  }
}

export {};
