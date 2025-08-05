import { provideHttpClient } from "@angular/common/http";
import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { appConfig } from "./app/app.config";
import "emoji-picker-element";

bootstrapApplication(AppComponent, {
  providers: [...appConfig.providers, provideHttpClient()],
});
