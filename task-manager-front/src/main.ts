// Ensure the <emoji-picker> web component is registered globally (side-effect import).
import "emoji-picker-element";
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
