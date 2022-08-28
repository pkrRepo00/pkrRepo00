//This Program is to Add two numbers input by the user.

#include<stdio.h>       //This is a header file which has the necessary information to include the input/output related functions in our program. 

int main()      //int main() is a function which represents that the function returns some integer even '0' at the end of the program execution
{
  
   int a,b,sum;       //Here we are declaring the integer variables a,b and sum. 
  
   printf("Enter the First Number :\n");        //printf() prints the given statement to the console. 
   scanf("%d",&a);                              //scanf() is one of the commonly used function to take input from the user.
  
   printf("Enter the Second Number :\n");
   scanf("%d",&b);
   
   sum = a + b;          //The value of a+b is assigned to the sum variable.
   
   printf("The Sum of %d + %d = %d",a,b,sum);       //Finally we print the value of sum.
   
  return 0;  //return 0 it indicates that our program has been run successfully and we terminate our main function with this return statement. 
}
