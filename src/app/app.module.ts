import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { FileUploaderComponent } from './file-uploader.component';

@NgModule({
  imports: [BrowserModule, FormsModule],
  declarations: [AppComponent, FileUploaderComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
