import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxSpinnerModule } from 'ngx-spinner';
import { HttpClientModule } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import {  httpModifierInterceptor } from '../providers/http/http.service';
import { PackagePricePipe } from '../pipes/package-price.pipe';
import { SafePipe } from '../pipes/safe.pipe';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  exports : [
    NgxSpinnerModule,
    HttpClientModule,
    ReactiveFormsModule
  ],
  providers : [    
    { 
      provide: HTTP_INTERCEPTORS,
      useClass: httpModifierInterceptor,
      multi: true 
    }
  ]
})
export class SharedModuleModule { }
